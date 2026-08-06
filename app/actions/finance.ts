'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets, categories, goals, holdings, transactions, user as users } from '@/lib/db/schema'
import { removeImage, uploadImage } from '@/lib/storage'
import { z } from 'zod'

async function getUserId() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) throw new Error('Não autorizado'); return session.user.id }
const textValue = (value: FormDataEntryValue | null) => String(value ?? '').trim()
const money = z.preprocess(value => {
  const number = Number(textValue(value as FormDataEntryValue | null).replace(',', '.'))
  return Number.isFinite(number) ? Math.round(number * 100) : Number.NaN
}, z.number().int().safe().positive())
const nonNegativeMoney = z.preprocess(value => {
  const number = Number(textValue(value as FormDataEntryValue | null).replace(',', '.'))
  return Number.isFinite(number) ? Math.round(number * 100) : Number.NaN
}, z.number().int().safe().nonnegative())
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const month = z.string().regex(/^\d{4}-\d{2}$/)

export async function updateUserProfile(form: FormData) {
  const userId = await getUserId()
  const name = z.string().trim().min(2, 'Informe um nome válido').max(80, 'O nome deve ter no máximo 80 caracteres').parse(form.get('name'))
  const existing = await db.select({ image: users.image }).from(users).where(eq(users.id, userId)).limit(1)
  if (!existing[0]) throw new Error('Usuário não encontrado')
  const newImage = await saveProfileImage(form.get('image'), userId)
  const removeImage = form.get('removeImage') === 'true'
  const image = newImage ?? (removeImage ? null : existing[0].image)
  const result = await db.update(users).set({ name, image, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id })
  if (!result.length) throw new Error('Usuário não encontrado')
  if ((newImage || removeImage) && existing[0].image) await removeProfileImage(existing[0].image)
  revalidatePath('/')
  return { name, image }
}

async function saveProfileImage(image: FormDataEntryValue | null, userId: string) {
  return image instanceof File ? uploadImage(image, userId, 'profile-images') : null
}

async function removeProfileImage(imagePath: string | null) {
  await removeImage(imagePath)
}

export async function addTransaction(form: FormData) {
  const userId = await getUserId()
  const parsed = z.object({ description: z.string().trim().min(2).max(80), type: z.enum(['income','expense']), date, amount: money, categoryId: z.coerce.number().int().positive().optional() }).parse({ description: form.get('description'), type: form.get('type'), date: form.get('date'), amount: form.get('amount'), categoryId: form.get('categoryId')==='none'?undefined:form.get('categoryId')||undefined })
  const recurring = form.get('recurring') === 'true'
  const recurrenceEnd = recurring ? date.parse(form.get('recurrenceEnd')) : null
  if (recurrenceEnd && recurrenceEnd < parsed.date) throw new Error('A data final deve ser igual ou posterior à primeira cobrança')
  if (parsed.categoryId) {
    const category = await db.select({ id: categories.id, type: categories.type }).from(categories).where(and(eq(categories.id, parsed.categoryId), eq(categories.userId, userId))).limit(1)
    if (!category[0] || category[0].type !== parsed.type) throw new Error('Categoria inválida para este lançamento')
  }
  const values=[];const [year,monthIndex,day]=parsed.date.split('-').map(Number);let offset=0
  do {const targetMonth=monthIndex-1+offset;const targetYear=year+Math.floor(targetMonth/12);const month=((targetMonth%12)+12)%12;const lastDay=new Date(Date.UTC(targetYear,month+1,0)).getUTCDate();const occurrence=`${targetYear}-${String(month+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;if(recurrenceEnd&&occurrence>recurrenceEnd)break;values.push({userId,description:parsed.description,type:parsed.type,date:occurrence,amountCents:parsed.amount,categoryId:parsed.categoryId,recurring});offset++;if(offset>120)throw new Error('O período recorrente deve ter no máximo 120 meses')}while(recurrenceEnd)
  await db.insert(transactions).values(values)
  revalidatePath('/')
}
export async function updateTransaction(id: number, form: FormData) {
  const userId = await getUserId()
  const safeId = z.number().int().positive().parse(id)
  const existing = await db.select().from(transactions).where(and(eq(transactions.id, safeId), eq(transactions.userId, userId))).limit(1)
  if (!existing[0]) throw new Error('Transação não encontrada')
  const parsed = z.object({ description: z.string().trim().min(2).max(80), type: z.enum(['income','expense']), date, amount: money, categoryId: z.coerce.number().int().positive().optional() }).parse({ description: form.get('description'), type: form.get('type'), date: form.get('date'), amount: form.get('amount'), categoryId: form.get('categoryId')==='none'?undefined:form.get('categoryId')||undefined })
  const recurring = form.get('recurring') === 'true'
  const recurrenceEnd = recurring ? date.parse(form.get('recurrenceEnd')) : null
  if (recurrenceEnd && recurrenceEnd <= parsed.date) throw new Error('A data final deve ser posterior à data desta transação')
  let categoryId: number|null = parsed.categoryId ?? null
  if (categoryId) {
    const category = await db.select({ id: categories.id, type: categories.type }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.userId, userId))).limit(1)
    if (!category[0] || category[0].type !== parsed.type) categoryId = null
  }
  const newImage = await saveTransactionImage(form.get('image'), userId)
  const removeImage = form.get('removeImage') === 'true'
  await db.update(transactions).set({ description: parsed.description, type: parsed.type, date: parsed.date, amountCents: parsed.amount, categoryId, recurring, imagePath: newImage??(removeImage?null:existing[0].imagePath) }).where(and(eq(transactions.id, safeId), eq(transactions.userId, userId)))
  if ((newImage || removeImage) && existing[0].imagePath) await removeTransactionImage(existing[0].imagePath)
  if(recurrenceEnd){const values=[];const [year,monthIndex,day]=parsed.date.split('-').map(Number);for(let offset=1;offset<=120;offset++){const targetMonth=monthIndex-1+offset;const targetYear=year+Math.floor(targetMonth/12);const month=((targetMonth%12)+12)%12;const lastDay=new Date(Date.UTC(targetYear,month+1,0)).getUTCDate();const occurrence=`${targetYear}-${String(month+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;if(occurrence>recurrenceEnd)break;values.push({userId,description:parsed.description,type:parsed.type,date:occurrence,amountCents:parsed.amount,categoryId,recurring:true})}if(values.length)await db.insert(transactions).values(values)}
  revalidatePath('/')
}
export async function deleteTransaction(id: number) { const userId = await getUserId(); const safeId = z.number().int().positive().parse(id); const existing=await db.select().from(transactions).where(and(eq(transactions.id,safeId),eq(transactions.userId,userId))).limit(1); if(!existing[0])throw new Error('Transação não encontrada'); await db.delete(transactions).where(and(eq(transactions.id, safeId), eq(transactions.userId, userId))); await removeTransactionImage(existing[0].imagePath); revalidatePath('/') }
export async function addCategory(form: FormData) { const userId = await getUserId(); const name = z.string().trim().min(2).max(30).parse(form.get('name')); const type = z.enum(['income','expense']).parse(form.get('type')); const color = z.string().regex(/^[a-z-]{3,20}$/).parse(form.get('color') || 'blue'); const icon=categoryIcon.parse(form.get('icon')||'wallet');const imagePath=await saveCategoryImage(form.get('image'),userId);await db.insert(categories).values({ userId, name, type, color, icon, imagePath }); revalidatePath('/') }

const categoryIcon=z.enum(['wallet','food','home','transport','shopping','health','education','leisure','work','gift','barber','pet','internet','gym','streaming','transitBenefit','supplements','bill','cardInsurance'])
async function saveCategoryImage(image:FormDataEntryValue|null,userId:string){return image instanceof File?uploadImage(image,userId,'category-icons'):null}
async function removeCategoryImage(imagePath:string|null){await removeImage(imagePath)}
async function saveTransactionImage(image:FormDataEntryValue|null,userId:string){return image instanceof File?uploadImage(image,userId,'transaction-images'):null}
async function removeTransactionImage(imagePath:string|null){await removeImage(imagePath)}
export async function updateCategory(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const existing=await db.select().from(categories).where(and(eq(categories.id,safeId),eq(categories.userId,userId))).limit(1);if(!existing[0])throw new Error('Categoria não encontrada');const name=z.string().trim().min(2).max(30).parse(form.get('name'));const type=z.enum(['income','expense']).parse(form.get('type'));const icon=categoryIcon.parse(form.get('icon')||'wallet');const newImage=await saveCategoryImage(form.get('image'),userId);const removeImage=form.get('removeImage')==='true';await db.update(categories).set({name,type,icon,imagePath:newImage??(removeImage?null:existing[0].imagePath)}).where(and(eq(categories.id,safeId),eq(categories.userId,userId)));if((newImage||removeImage)&&existing[0].imagePath)await removeCategoryImage(existing[0].imagePath);revalidatePath('/')}
export async function deleteCategory(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const existing=await db.select().from(categories).where(and(eq(categories.id,safeId),eq(categories.userId,userId))).limit(1);if(!existing[0])throw new Error('Categoria não encontrada');await db.update(transactions).set({categoryId:null}).where(and(eq(transactions.categoryId,safeId),eq(transactions.userId,userId)));await db.delete(categories).where(and(eq(categories.id,safeId),eq(categories.userId,userId)));await removeCategoryImage(existing[0].imagePath);revalidatePath('/')}

const importedTransaction=z.object({description:z.string().trim().min(2).max(80),type:z.enum(['income','expense']),date,amountCents:z.number().int().safe().positive(),categoryName:z.string().trim().max(30).optional()})
export async function importTransactions(input:unknown){const userId=await getUserId();const rows=z.array(importedTransaction).min(1).max(1000).parse(input);const userCategories=await db.select().from(categories).where(eq(categories.userId,userId));const values=rows.map(row=>{const category=userCategories.find(item=>item.type===row.type&&item.name.toLocaleLowerCase('pt-BR')===row.categoryName?.toLocaleLowerCase('pt-BR'));return{userId,description:row.description,type:row.type,date:row.date,amountCents:row.amountCents,categoryId:category?.id??null}});await db.insert(transactions).values(values);revalidatePath('/');return{count:values.length}}
export async function addGoal(form: FormData) { const userId = await getUserId(); const parsed = z.object({name:z.string().trim().min(2).max(50),target:money,current:nonNegativeMoney,deadline:z.union([date,z.literal('')])}).parse({name:form.get('name'),target:form.get('target'),current:form.get('current'),deadline:textValue(form.get('deadline'))}); if(parsed.current>parsed.target) throw new Error('O valor atual não pode superar o objetivo'); await db.insert(goals).values({ userId, name:parsed.name, targetCents:parsed.target, currentCents:parsed.current, deadline:parsed.deadline || null }); revalidatePath('/') }
export async function addBudget(form: FormData) { const userId = await getUserId(); const parsed=z.object({name:z.string().trim().min(2).max(50),limit:money,month,categoryId:z.coerce.number().int().positive()}).parse({name:form.get('name'),limit:form.get('limit'),month:form.get('month'),categoryId:form.get('categoryId')});const category=await db.select({id:categories.id,type:categories.type}).from(categories).where(and(eq(categories.id,parsed.categoryId),eq(categories.userId,userId))).limit(1);if(!category[0]||category[0].type!=='expense')throw new Error('Selecione uma categoria de despesa válida'); await db.insert(budgets).values({ userId, name:parsed.name, limitCents:parsed.limit, month:parsed.month,categoryId:parsed.categoryId }); revalidatePath('/') }
export async function updateGoal(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const parsed=z.object({name:z.string().trim().min(2).max(50),target:money,current:nonNegativeMoney,deadline:z.union([date,z.literal('')])}).parse({name:form.get('name'),target:form.get('target'),current:form.get('current'),deadline:textValue(form.get('deadline'))});if(parsed.current>parsed.target)throw new Error('O valor atual não pode superar o objetivo');const result=await db.update(goals).set({name:parsed.name,targetCents:parsed.target,currentCents:parsed.current,deadline:parsed.deadline||null}).where(and(eq(goals.id,safeId),eq(goals.userId,userId))).returning({id:goals.id});if(!result.length)throw new Error('Meta não encontrada');revalidatePath('/')}
export async function deleteGoal(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const result=await db.delete(goals).where(and(eq(goals.id,safeId),eq(goals.userId,userId))).returning({id:goals.id});if(!result.length)throw new Error('Meta não encontrada');revalidatePath('/')}
export async function updateBudget(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const parsed=z.object({name:z.string().trim().min(2).max(50),limit:money,month,categoryId:z.coerce.number().int().positive()}).parse({name:form.get('name'),limit:form.get('limit'),month:form.get('month'),categoryId:form.get('categoryId')});const category=await db.select({id:categories.id,type:categories.type}).from(categories).where(and(eq(categories.id,parsed.categoryId),eq(categories.userId,userId))).limit(1);if(!category[0]||category[0].type!=='expense')throw new Error('Selecione uma categoria de despesa válida');const result=await db.update(budgets).set({name:parsed.name,limitCents:parsed.limit,month:parsed.month,categoryId:parsed.categoryId}).where(and(eq(budgets.id,safeId),eq(budgets.userId,userId))).returning({id:budgets.id});if(!result.length)throw new Error('Orçamento não encontrado');revalidatePath('/')}
export async function deleteBudget(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const result=await db.delete(budgets).where(and(eq(budgets.id,safeId),eq(budgets.userId,userId))).returning({id:budgets.id});if(!result.length)throw new Error('Orçamento não encontrado');revalidatePath('/')}
export async function addHolding(form: FormData) { const userId = await getUserId(); const assetType=z.enum(['stock','crypto','fund','cdb','treasury']).parse(form.get('assetType'));const parsed=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{2,20}$/),quantity:z.coerce.number().finite().positive(),averageCost:money,applicationDate:date.optional()}).parse({symbol:form.get('symbol'),quantity:form.get('quantity'),averageCost:form.get('averageCost'),applicationDate:textValue(form.get('applicationDate'))||undefined});if((assetType==='cdb'||assetType==='treasury')&&!parsed.applicationDate)throw new Error('Informe a data da aplicação'); await db.insert(holdings).values({ userId, symbol:parsed.symbol, assetType, quantity:String(parsed.quantity), averageCostCents:parsed.averageCost,applicationDate:parsed.applicationDate??null }); revalidatePath('/') }
export async function updateHolding(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const assetType=z.enum(['stock','crypto','fund','cdb','treasury']).parse(form.get('assetType'));const parsed=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{2,20}$/),quantity:z.coerce.number().finite().positive(),averageCost:money,applicationDate:date.optional()}).parse({symbol:form.get('symbol'),quantity:form.get('quantity'),averageCost:form.get('averageCost'),applicationDate:textValue(form.get('applicationDate'))||undefined});if((assetType==='cdb'||assetType==='treasury')&&!parsed.applicationDate)throw new Error('Informe a data da aplicação');const result=await db.update(holdings).set({symbol:parsed.symbol,assetType,quantity:String(parsed.quantity),averageCostCents:parsed.averageCost,applicationDate:parsed.applicationDate??null}).where(and(eq(holdings.id,safeId),eq(holdings.userId,userId))).returning({id:holdings.id});if(!result.length)throw new Error('Ativo não encontrado');revalidatePath('/')}
export async function deleteHolding(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const result=await db.delete(holdings).where(and(eq(holdings.id,safeId),eq(holdings.userId,userId))).returning({id:holdings.id});if(!result.length)throw new Error('Ativo não encontrado');revalidatePath('/')}

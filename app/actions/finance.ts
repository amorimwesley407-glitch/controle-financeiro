'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, between, desc, eq, isNotNull, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets, categories, financialAccounts, goals, holdings, transactions, transfers, user as users } from '@/lib/db/schema'
import { getInstallmentDates, splitInstallments } from '@/lib/accounts'
import { findMissingCategories, matchCategory, MAX_NEW_CATEGORIES_PER_IMPORT, skipExistingTransactions } from '@/lib/import'
import { findLearnedCategory, findSuggestedCategory } from '@/lib/categorize'
import { parseMoneyToCents } from '@/lib/money'
import { removeImage, uploadImage } from '@/lib/storage'
import { z } from 'zod'

async function getUserId() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) throw new Error('Não autorizado'); return session.user.id }
const textValue = (value: FormDataEntryValue | null) => String(value ?? '').trim()
const money = z.preprocess(parseMoneyToCents, z.number().int().safe().positive())
const nonNegativeMoney = z.preprocess(parseMoneyToCents, z.number().int().safe().nonnegative())
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
  if ((newImage || removeImage) && existing[0].image) await removeProfileImage(existing[0].image, userId)
  revalidatePath('/')
  return { name, image }
}

async function saveProfileImage(image: FormDataEntryValue | null, userId: string) {
  return image instanceof File ? uploadImage(image, userId, 'profile-images') : null
}

async function removeProfileImage(imagePath: string | null, userId: string) {
  await removeImage(imagePath, userId)
}

/** Sugere a categoria: primeiro o que o usuário já escolheu para essa descrição, depois as regras gerais. */
async function categorySuggester<T extends { id: number; name: string; type: string }>(userId: string, userCategories: T[]) {
  const history = await db.select({ description: transactions.description, type: transactions.type, categoryId: transactions.categoryId }).from(transactions).where(and(eq(transactions.userId, userId), isNotNull(transactions.categoryId))).orderBy(desc(transactions.date), desc(transactions.id))
  return (description: string, type: string) => findLearnedCategory(description, type, history, userCategories) ?? findSuggestedCategory(description, type, userCategories)
}
const parseNotes = (form: FormData) => z.string().trim().max(500, 'As observações devem ter no máximo 500 caracteres').parse(textValue(form.get('notes'))) || null
export async function addTransaction(form: FormData) {
  const userId = await getUserId()
  const parsed = z.object({ description: z.string().trim().min(2).max(80), type: z.enum(['income','expense']), date, amount: money, categoryId: z.coerce.number().int().positive().optional() }).parse({ description: form.get('description'), type: form.get('type'), date: form.get('date'), amount: form.get('amount'), categoryId: form.get('categoryId')==='none'?undefined:form.get('categoryId')||undefined })
  const recurring = form.get('recurring') === 'true'
  const recurrenceEnd = recurring ? date.parse(form.get('recurrenceEnd')) : null
  if (recurrenceEnd && recurrenceEnd < parsed.date) throw new Error('A data final deve ser igual ou posterior à primeira cobrança')
  if (parsed.categoryId) {
    const category = await db.select({ id: categories.id, type: categories.type }).from(categories).where(and(eq(categories.id, parsed.categoryId), eq(categories.userId, userId))).limit(1)
    if (!category[0] || category[0].type !== parsed.type) throw new Error('Categoria inválida para este lançamento')
  } else {
    const userCategories = await db.select({ id: categories.id, name: categories.name, type: categories.type }).from(categories).where(eq(categories.userId, userId))
    parsed.categoryId = (await categorySuggester(userId, userCategories))(parsed.description, parsed.type)?.id
  }
  const notes = parseNotes(form)
  const account = await getOwnedAccount(form.get('accountId'), userId)
  const accountId = account?.id ?? null
  const installments = z.coerce.number().int().min(1).max(48).parse(form.get('installments') || 1)
  if (installments > 1) {
    if (parsed.type !== 'expense' || account?.kind !== 'credit_card' || account.closingDay === null) throw new Error('Parcelas só valem para despesas em um cartão de crédito')
    if (recurring) throw new Error('Um lançamento não pode ser parcelado e recorrente ao mesmo tempo')
    if (parsed.amount < installments) throw new Error('O valor é pequeno demais para esse número de parcelas')
    const installmentGroup = crypto.randomUUID()
    const dates = getInstallmentDates(parsed.date, installments, account.closingDay)
    await db.insert(transactions).values(splitInstallments(parsed.amount, installments).map((amountCents, index) => ({ userId, description: parsed.description, type: parsed.type, date: dates[index], amountCents, categoryId: parsed.categoryId, accountId, notes, installmentGroup, installmentNumber: index + 1, installmentTotal: installments })))
    revalidatePath('/')
    return
  }
  const values=[];const [year,monthIndex,day]=parsed.date.split('-').map(Number);let offset=0
  do {const targetMonth=monthIndex-1+offset;const targetYear=year+Math.floor(targetMonth/12);const month=((targetMonth%12)+12)%12;const lastDay=new Date(Date.UTC(targetYear,month+1,0)).getUTCDate();const occurrence=`${targetYear}-${String(month+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;if(recurrenceEnd&&occurrence>recurrenceEnd)break;values.push({userId,description:parsed.description,type:parsed.type,date:occurrence,amountCents:parsed.amount,categoryId:parsed.categoryId,accountId,notes,recurring});offset++;if(offset>120)throw new Error('O período recorrente deve ter no máximo 120 meses')}while(recurrenceEnd)
  await db.insert(transactions).values(values)
  revalidatePath('/')
}
/** Conta escolhida no formulário, conferindo o dono. Vazio ou "none" significa sem conta. */
async function getOwnedAccount(value: FormDataEntryValue | null, userId: string) {
  if (!value || value === 'none') return null
  const id = z.coerce.number().int().positive().parse(value)
  const [account] = await db.select().from(financialAccounts).where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId))).limit(1)
  if (!account) throw new Error('Conta inválida')
  return account
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
  const notes = parseNotes(form)
  const accountId = (await getOwnedAccount(form.get('accountId'), userId))?.id ?? null
  const newImage = await saveTransactionImage(form.get('image'), userId)
  const removeImage = form.get('removeImage') === 'true'
  await db.update(transactions).set({ description: parsed.description, type: parsed.type, date: parsed.date, amountCents: parsed.amount, categoryId, accountId, notes, recurring, imagePath: newImage??(removeImage?null:existing[0].imagePath) }).where(and(eq(transactions.id, safeId), eq(transactions.userId, userId)))
  if ((newImage || removeImage) && existing[0].imagePath) await removeTransactionImage(existing[0].imagePath,userId)
  if(recurrenceEnd){const values=[];const [year,monthIndex,day]=parsed.date.split('-').map(Number);for(let offset=1;offset<=120;offset++){const targetMonth=monthIndex-1+offset;const targetYear=year+Math.floor(targetMonth/12);const month=((targetMonth%12)+12)%12;const lastDay=new Date(Date.UTC(targetYear,month+1,0)).getUTCDate();const occurrence=`${targetYear}-${String(month+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;if(occurrence>recurrenceEnd)break;values.push({userId,description:parsed.description,type:parsed.type,date:occurrence,amountCents:parsed.amount,categoryId,accountId,notes,recurring:true})}if(values.length)await db.insert(transactions).values(values)}
  revalidatePath('/')
}
export async function deleteTransaction(id: number) { const userId = await getUserId(); const safeId = z.number().int().positive().parse(id); const existing=await db.select().from(transactions).where(and(eq(transactions.id,safeId),eq(transactions.userId,userId))).limit(1); if(!existing[0])throw new Error('Transação não encontrada'); await db.delete(transactions).where(and(eq(transactions.id, safeId), eq(transactions.userId, userId))); await removeTransactionImage(existing[0].imagePath,userId); revalidatePath('/') }
export async function deleteInstallments(group: string) {
  const userId = await getUserId()
  const safeGroup = z.string().uuid().parse(group)
  const removed = await db.delete(transactions).where(and(eq(transactions.installmentGroup, safeGroup), eq(transactions.userId, userId))).returning({ imagePath: transactions.imagePath })
  if (!removed.length) throw new Error('Parcelas não encontradas')
  await Promise.all(removed.map(item => removeTransactionImage(item.imagePath, userId)))
  revalidatePath('/')
}

function parseAccountForm(form: FormData) {
  const parsed = z.object({ name: z.string().trim().min(2).max(40), kind: z.enum(['checking', 'savings', 'cash', 'credit_card']), initialBalance: z.preprocess(value => parseMoneyToCents(value || 0), z.number().int().safe()) }).parse({ name: form.get('name'), kind: form.get('kind'), initialBalance: form.get('initialBalance') })
  if (parsed.kind !== 'credit_card') return { name: parsed.name, kind: parsed.kind, initialBalanceCents: parsed.initialBalance, closingDay: null, dueDay: null }
  const day = z.coerce.number().int().min(1).max(31)
  // No cartão o formulário pede a dívida já existente, que entra no saldo como valor negativo.
  return { name: parsed.name, kind: parsed.kind, initialBalanceCents: -Math.abs(parsed.initialBalance), closingDay: day.parse(form.get('closingDay')), dueDay: day.parse(form.get('dueDay')) }
}
export async function addAccount(form: FormData) {
  const userId = await getUserId()
  const result = await db.insert(financialAccounts).values({ userId, ...parseAccountForm(form) }).onConflictDoNothing().returning({ id: financialAccounts.id })
  if (!result.length) throw new Error('Já existe uma conta com esse nome')
  revalidatePath('/')
}
export async function updateAccount(id: number, form: FormData) {
  const userId = await getUserId()
  const safeId = z.number().int().positive().parse(id)
  const values = parseAccountForm(form)
  const [duplicate] = await db.select({ id: financialAccounts.id }).from(financialAccounts).where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.name, values.name))).limit(1)
  if (duplicate && duplicate.id !== safeId) throw new Error('Já existe uma conta com esse nome')
  const result = await db.update(financialAccounts).set(values).where(and(eq(financialAccounts.id, safeId), eq(financialAccounts.userId, userId))).returning({ id: financialAccounts.id })
  if (!result.length) throw new Error('Conta não encontrada')
  revalidatePath('/')
}
export async function deleteAccount(id: number) {
  const userId = await getUserId()
  const safeId = z.number().int().positive().parse(id)
  // Apagar a conta levaria junto as transferências e mudaria o saldo da outra ponta.
  const [linked] = await db.select({ id: transfers.id }).from(transfers).where(and(eq(transfers.userId, userId), or(eq(transfers.fromAccountId, safeId), eq(transfers.toAccountId, safeId)))).limit(1)
  if (linked) throw new Error('Exclua antes as transferências desta conta')
  const result = await db.delete(financialAccounts).where(and(eq(financialAccounts.id, safeId), eq(financialAccounts.userId, userId))).returning({ id: financialAccounts.id })
  if (!result.length) throw new Error('Conta não encontrada')
  revalidatePath('/')
}
export async function addTransfer(form: FormData) {
  const userId = await getUserId()
  const parsed = z.object({ amount: money, date, description: z.string().trim().max(80) }).parse({ amount: form.get('amount'), date: form.get('date'), description: textValue(form.get('description')) })
  const from = await getOwnedAccount(form.get('fromAccountId'), userId)
  const to = await getOwnedAccount(form.get('toAccountId'), userId)
  if (!from || !to) throw new Error('Selecione as duas contas')
  if (from.id === to.id) throw new Error('Escolha contas diferentes')
  await db.insert(transfers).values({ userId, fromAccountId: from.id, toAccountId: to.id, amountCents: parsed.amount, date: parsed.date, description: parsed.description })
  revalidatePath('/')
}
export async function deleteTransfer(id: number) {
  const userId = await getUserId()
  const safeId = z.number().int().positive().parse(id)
  const result = await db.delete(transfers).where(and(eq(transfers.id, safeId), eq(transfers.userId, userId))).returning({ id: transfers.id })
  if (!result.length) throw new Error('Transferência não encontrada')
  revalidatePath('/')
}
export async function addCategory(form: FormData) { const userId = await getUserId(); const name = z.string().trim().min(2).max(30).parse(form.get('name')); const type = z.enum(['income','expense']).parse(form.get('type')); const color = z.string().regex(/^[a-z-]{3,20}$/).parse(form.get('color') || 'blue'); const icon=categoryIcon.parse(form.get('icon')||'wallet');const imagePath=await saveCategoryImage(form.get('image'),userId);await db.insert(categories).values({ userId, name, type, color, icon, imagePath }); revalidatePath('/') }

const categoryIcon=z.enum(['wallet','food','home','transport','shopping','health','education','leisure','work','gift','barber','pet','internet','gym','streaming','transitBenefit','supplements','bill','cardInsurance'])
async function saveCategoryImage(image:FormDataEntryValue|null,userId:string){return image instanceof File?uploadImage(image,userId,'category-icons'):null}
async function removeCategoryImage(imagePath:string|null,userId:string){await removeImage(imagePath,userId)}
async function saveTransactionImage(image:FormDataEntryValue|null,userId:string){return image instanceof File?uploadImage(image,userId,'transaction-images'):null}
async function removeTransactionImage(imagePath:string|null,userId:string){await removeImage(imagePath,userId)}
export async function updateCategory(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const existing=await db.select().from(categories).where(and(eq(categories.id,safeId),eq(categories.userId,userId))).limit(1);if(!existing[0])throw new Error('Categoria não encontrada');const name=z.string().trim().min(2).max(30).parse(form.get('name'));const type=z.enum(['income','expense']).parse(form.get('type'));const icon=categoryIcon.parse(form.get('icon')||'wallet');const newImage=await saveCategoryImage(form.get('image'),userId);const removeImage=form.get('removeImage')==='true';await db.update(categories).set({name,type,icon,imagePath:newImage??(removeImage?null:existing[0].imagePath)}).where(and(eq(categories.id,safeId),eq(categories.userId,userId)));if((newImage||removeImage)&&existing[0].imagePath)await removeCategoryImage(existing[0].imagePath,userId);revalidatePath('/')}
export async function deleteCategory(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const existing=await db.select().from(categories).where(and(eq(categories.id,safeId),eq(categories.userId,userId))).limit(1);if(!existing[0])throw new Error('Categoria não encontrada');await db.update(transactions).set({categoryId:null}).where(and(eq(transactions.categoryId,safeId),eq(transactions.userId,userId)));await db.delete(categories).where(and(eq(categories.id,safeId),eq(categories.userId,userId)));await removeCategoryImage(existing[0].imagePath,userId);revalidatePath('/')}

const importedTransaction=z.object({description:z.string().trim().min(2).max(80),type:z.enum(['income','expense']),date,amountCents:z.number().int().safe().positive(),categoryName:z.string().trim().max(30).optional()})
export async function importTransactions(input:unknown){
  const userId=await getUserId()
  const parsedRows=z.array(importedTransaction).min(1).max(1000).parse(input)
  const dates=parsedRows.map(row=>row.date).sort()
  const existing=await db.select({type:transactions.type,date:transactions.date,amountCents:transactions.amountCents,description:transactions.description}).from(transactions).where(and(eq(transactions.userId,userId),between(transactions.date,dates[0],dates.at(-1)!)))
  const {fresh:rows,skipped}=skipExistingTransactions(parsedRows,existing)
  if(!rows.length)return{count:0,skipped,newCategories:0}
  let userCategories=await db.select().from(categories).where(eq(categories.userId,userId))
  const missing=findMissingCategories(rows,userCategories)
  if(missing.length>MAX_NEW_CATEGORIES_PER_IMPORT)throw new Error(`O arquivo cria ${missing.length} categorias novas (máximo ${MAX_NEW_CATEGORIES_PER_IMPORT}). Verifique a coluna Categoria.`)
  if(missing.length){
    await db.insert(categories).values(missing.map(item=>({userId,name:item.name,type:item.type}))).onConflictDoNothing()
    userCategories=await db.select().from(categories).where(eq(categories.userId,userId))
  }
  const suggest=await categorySuggester(userId,userCategories)
  const values=rows.map(row=>({userId,description:row.description,type:row.type,date:row.date,amountCents:row.amountCents,categoryId:(matchCategory(row,userCategories)??(row.categoryName?.trim()?undefined:suggest(row.description,row.type)))?.id??null}))
  await db.insert(transactions).values(values)
  revalidatePath('/')
  return{count:values.length,skipped,newCategories:missing.length}
}
export async function addGoal(form: FormData) { const userId = await getUserId(); const parsed = z.object({name:z.string().trim().min(2).max(50),target:money,current:nonNegativeMoney,deadline:z.union([date,z.literal('')])}).parse({name:form.get('name'),target:form.get('target'),current:form.get('current'),deadline:textValue(form.get('deadline'))}); if(parsed.current>parsed.target) throw new Error('O valor atual não pode superar o objetivo'); await db.insert(goals).values({ userId, name:parsed.name, targetCents:parsed.target, currentCents:parsed.current, deadline:parsed.deadline || null }); revalidatePath('/') }
export async function addBudget(form: FormData) { const userId = await getUserId(); const parsed=z.object({name:z.string().trim().min(2).max(50),limit:money,month,categoryId:z.coerce.number().int().positive()}).parse({name:form.get('name'),limit:form.get('limit'),month:form.get('month'),categoryId:form.get('categoryId')});const category=await db.select({id:categories.id,type:categories.type}).from(categories).where(and(eq(categories.id,parsed.categoryId),eq(categories.userId,userId))).limit(1);if(!category[0]||category[0].type!=='expense')throw new Error('Selecione uma categoria de despesa válida'); await db.insert(budgets).values({ userId, name:parsed.name, limitCents:parsed.limit, month:parsed.month,categoryId:parsed.categoryId }); revalidatePath('/') }
export async function updateGoal(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const parsed=z.object({name:z.string().trim().min(2).max(50),target:money,current:nonNegativeMoney,deadline:z.union([date,z.literal('')])}).parse({name:form.get('name'),target:form.get('target'),current:form.get('current'),deadline:textValue(form.get('deadline'))});if(parsed.current>parsed.target)throw new Error('O valor atual não pode superar o objetivo');const result=await db.update(goals).set({name:parsed.name,targetCents:parsed.target,currentCents:parsed.current,deadline:parsed.deadline||null}).where(and(eq(goals.id,safeId),eq(goals.userId,userId))).returning({id:goals.id});if(!result.length)throw new Error('Meta não encontrada');revalidatePath('/')}
export async function deleteGoal(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const result=await db.delete(goals).where(and(eq(goals.id,safeId),eq(goals.userId,userId))).returning({id:goals.id});if(!result.length)throw new Error('Meta não encontrada');revalidatePath('/')}
export async function updateBudget(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const parsed=z.object({name:z.string().trim().min(2).max(50),limit:money,month,categoryId:z.coerce.number().int().positive()}).parse({name:form.get('name'),limit:form.get('limit'),month:form.get('month'),categoryId:form.get('categoryId')});const category=await db.select({id:categories.id,type:categories.type}).from(categories).where(and(eq(categories.id,parsed.categoryId),eq(categories.userId,userId))).limit(1);if(!category[0]||category[0].type!=='expense')throw new Error('Selecione uma categoria de despesa válida');const result=await db.update(budgets).set({name:parsed.name,limitCents:parsed.limit,month:parsed.month,categoryId:parsed.categoryId}).where(and(eq(budgets.id,safeId),eq(budgets.userId,userId))).returning({id:budgets.id});if(!result.length)throw new Error('Orçamento não encontrado');revalidatePath('/')}
export async function deleteBudget(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const result=await db.delete(budgets).where(and(eq(budgets.id,safeId),eq(budgets.userId,userId))).returning({id:budgets.id});if(!result.length)throw new Error('Orçamento não encontrado');revalidatePath('/')}
export async function addHolding(form: FormData) { const userId = await getUserId(); const assetType=z.enum(['stock','crypto','fund','cdb','treasury']).parse(form.get('assetType'));const parsed=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{2,20}$/),quantity:z.coerce.number().finite().positive(),averageCost:money,applicationDate:date.optional()}).parse({symbol:form.get('symbol'),quantity:form.get('quantity'),averageCost:form.get('averageCost'),applicationDate:textValue(form.get('applicationDate'))||undefined});if((assetType==='cdb'||assetType==='treasury')&&!parsed.applicationDate)throw new Error('Informe a data da aplicação'); await db.insert(holdings).values({ userId, symbol:parsed.symbol, assetType, quantity:String(parsed.quantity), averageCostCents:parsed.averageCost,applicationDate:parsed.applicationDate??null }); revalidatePath('/') }
export async function updateHolding(id:number,form:FormData){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const assetType=z.enum(['stock','crypto','fund','cdb','treasury']).parse(form.get('assetType'));const parsed=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{2,20}$/),quantity:z.coerce.number().finite().positive(),averageCost:money,applicationDate:date.optional()}).parse({symbol:form.get('symbol'),quantity:form.get('quantity'),averageCost:form.get('averageCost'),applicationDate:textValue(form.get('applicationDate'))||undefined});if((assetType==='cdb'||assetType==='treasury')&&!parsed.applicationDate)throw new Error('Informe a data da aplicação');const result=await db.update(holdings).set({symbol:parsed.symbol,assetType,quantity:String(parsed.quantity),averageCostCents:parsed.averageCost,applicationDate:parsed.applicationDate??null}).where(and(eq(holdings.id,safeId),eq(holdings.userId,userId))).returning({id:holdings.id});if(!result.length)throw new Error('Ativo não encontrado');revalidatePath('/')}
export async function deleteHolding(id:number){const userId=await getUserId();const safeId=z.number().int().positive().parse(id);const result=await db.delete(holdings).where(and(eq(holdings.id,safeId),eq(holdings.userId,userId))).returning({id:holdings.id});if(!result.length)throw new Error('Ativo não encontrado');revalidatePath('/')}

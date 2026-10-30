import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets, categories, financialAccounts, goals, holdings, transactions, transfers } from '@/lib/db/schema'
import { FinanceDashboard } from '@/components/finance-dashboard'
import { signImageUrls } from '@/lib/storage'
import { createDefaultCategories } from '@/lib/default-categories'

async function getUserCategories(userId:string){
  const rows=await db.select().from(categories).where(eq(categories.userId,userId))
  if(rows.length)return rows
  // Usuários criados antes do hook de cadastro: cria as categorias padrão uma única vez.
  await createDefaultCategories(userId)
  return db.select().from(categories).where(eq(categories.userId,userId))
}
export default async function Page(){
 const current=await auth.api.getSession({headers:await headers()});if(!current?.user)redirect('/sign-in');const userId=current.user.id
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const [tx,rawCats,userGoals,userBudgets,userHoldings,userAccounts,userTransfers]=await Promise.all([db.select().from(transactions).where(eq(transactions.userId,userId)).orderBy(desc(transactions.date)),getUserCategories(userId),db.select().from(goals).where(eq(goals.userId,userId)),db.select().from(budgets).where(eq(budgets.userId,userId)),db.select().from(holdings).where(eq(holdings.userId,userId)),db.select().from(financialAccounts).where(eq(financialAccounts.userId,userId)).orderBy(financialAccounts.name),db.select().from(transfers).where(eq(transfers.userId,userId)).orderBy(desc(transfers.date))])
 const imageUrls=await signImageUrls([current.user.image,...rawCats.map(item=>item.imagePath),...tx.map(item=>item.imagePath)],current.user.id)
 const cats=rawCats.map(item=>({...item,imagePath:item.imagePath?imageUrls.get(item.imagePath)??null:null}))
 const enrichedTransactions=tx.map(item=>{const category=cats.find(entry=>entry.id===item.categoryId);return {...item,imagePath:item.imagePath?imageUrls.get(item.imagePath)??null:null,categoryName:category?.name,categoryIcon:category?.icon,categoryImage:category?.imagePath,accountName:userAccounts.find(entry=>entry.id===item.accountId)?.name}})
 return <FinanceDashboard currentDate={today} user={{name:current.user.name,email:current.user.email,image:current.user.image?imageUrls.get(current.user.image)??null:null}} transactions={enrichedTransactions} categories={cats} goals={userGoals} budgets={userBudgets} holdings={userHoldings} accounts={userAccounts} transfers={userTransfers}/>
}

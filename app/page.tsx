import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets, categories, goals, holdings, transactions } from '@/lib/db/schema'
import { FinanceDashboard } from '@/components/finance-dashboard'
import { z } from 'zod'

async function getQuotes(){
  const fallback=[{symbol:'USD',name:'Dólar comercial',value:5.47,change:0.18,kind:'currency'},{symbol:'BTC',name:'Bitcoin',value:675420,change:1.24,kind:'crypto'},{symbol:'EUR',name:'Euro',value:6.38,change:-0.11,kind:'currency'}]
  const fxSchema=z.object({USDBRL:z.object({bid:z.coerce.number().finite().positive(),pctChange:z.coerce.number().finite()}),EURBRL:z.object({bid:z.coerce.number().finite().positive(),pctChange:z.coerce.number().finite()})})
  const btcSchema=z.object({bitcoin:z.object({brl:z.number().finite().positive(),brl_24h_change:z.number().finite()})})
  const request=(url:string,revalidate:number)=>fetch(url,{next:{revalidate},signal:AbortSignal.timeout(5000)}).then(async response=>{if(!response.ok)throw new Error(`Cotação indisponível (${response.status})`);return response.json()})
  try { const [fx,btc]=await Promise.all([request('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL',900),request('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true',300)]); const a=fxSchema.parse(fx);const b=btcSchema.parse(btc);return [{symbol:'USD',name:'Dólar comercial',value:a.USDBRL.bid,change:a.USDBRL.pctChange,kind:'currency'},{symbol:'BTC',name:'Bitcoin',value:b.bitcoin.brl,change:b.bitcoin.brl_24h_change,kind:'crypto'},{symbol:'EUR',name:'Euro',value:a.EURBRL.bid,change:a.EURBRL.pctChange,kind:'currency'}] } catch{return fallback}
}
async function getStockQuotes(){
  const freeSymbols=['PETR4','VALE3','ITUB4','MGLU3']
  const fullSymbols=['PETR4','VALE3','ITUB4','BBAS3','BBDC4','ABEV3','WEGE3','B3SA3','ELET3','RENT3']
  const token=process.env.BRAPI_TOKEN
  const symbols=token?fullSymbols:freeSymbols
  const quoteSchema=z.object({results:z.array(z.object({symbol:z.string(),shortName:z.string().optional(),longName:z.string().optional(),logourl:z.string().url().optional(),regularMarketPrice:z.number().finite(),regularMarketChangePercent:z.number().finite().catch(0),regularMarketTime:z.string().optional()}))})
  try {
    const response=await fetch(`https://brapi.dev/api/quote/${symbols.join(',')}`,{headers:token?{Authorization:`Bearer ${token}`}:{},next:{revalidate:300},signal:AbortSignal.timeout(5000)})
    if(!response.ok)throw new Error(`Cotações B3 indisponíveis (${response.status})`)
    const data=quoteSchema.parse(await response.json())
    const baseQuotes=data.results.map(item=>({symbol:item.symbol,name:item.shortName||item.longName||item.symbol,logoUrl:item.logourl??`https://icons.brapi.dev/icons/${item.symbol}.svg`,price:item.regularMarketPrice,change:item.regularMarketChangePercent,updatedAt:item.regularMarketTime??null}))
    if(token)return baseQuotes
    try{
      const bankResponse=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/BBAS3.SA?interval=1d&range=5d',{next:{revalidate:300},signal:AbortSignal.timeout(5000)})
      if(!bankResponse.ok)return baseQuotes
      const bankSchema=z.object({chart:z.object({result:z.array(z.object({meta:z.object({regularMarketPrice:z.number().finite().positive(),chartPreviousClose:z.number().finite().positive(),regularMarketTime:z.number().optional()})})).min(1)})})
      const meta=bankSchema.parse(await bankResponse.json()).chart.result[0].meta
      const change=(meta.regularMarketPrice-meta.chartPreviousClose)/meta.chartPreviousClose*100
      return[...baseQuotes,{symbol:'BBAS3',name:'Banco do Brasil',logoUrl:'https://icons.brapi.dev/icons/BBAS3.svg',price:meta.regularMarketPrice,change,updatedAt:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString():null}]
    }catch{return baseQuotes}
  } catch{return []}
}
async function getSelic(){
  const schema=z.array(z.object({data:z.string(),valor:z.coerce.number().finite().nonnegative()}))
  try{
    const response=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',{next:{revalidate:3600},signal:AbortSignal.timeout(5000)})
    if(!response.ok)throw new Error(`Selic indisponível (${response.status})`)
    const latest=schema.parse(await response.json()).at(-1)
    return latest?{value:latest.valor,date:latest.data}:null
  }catch{return null}
}
async function getUserCategories(userId:string){
  await db.insert(categories).values([
    {userId,name:'Salário',type:'income',color:'green',icon:'work'},
    {userId,name:'Renda extra',type:'income',color:'green',icon:'wallet'},
    {userId,name:'Alimentação',type:'expense',color:'orange',icon:'food'},
    {userId,name:'Moradia',type:'expense',color:'blue',icon:'home'},
    {userId,name:'Transporte',type:'expense',color:'blue',icon:'transport'},
    {userId,name:'Saúde',type:'expense',color:'red',icon:'health'},
    {userId,name:'Educação',type:'expense',color:'purple',icon:'education'},
    {userId,name:'Lazer',type:'expense',color:'purple',icon:'leisure'},
    {userId,name:'Compras',type:'expense',color:'orange',icon:'shopping'},
    {userId,name:'Presentes',type:'expense',color:'pink',icon:'gift'},
  ]).onConflictDoNothing()
  return db.select().from(categories).where(eq(categories.userId,userId))
}
export default async function Page(){
 const current=await auth.api.getSession({headers:await headers()});if(!current?.user)redirect('/sign-in');const userId=current.user.id
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const [tx,cats,userGoals,userBudgets,userHoldings,quotes,stockQuotes,selic]=await Promise.all([db.select().from(transactions).where(eq(transactions.userId,userId)).orderBy(desc(transactions.date)),getUserCategories(userId),db.select().from(goals).where(eq(goals.userId,userId)),db.select().from(budgets).where(eq(budgets.userId,userId)),db.select().from(holdings).where(eq(holdings.userId,userId)),getQuotes(),getStockQuotes(),getSelic()])
 const marketIndicators=selic?[...quotes,{symbol:'SELIC',name:'Meta Selic',value:selic.value,change:0,kind:'rate'}]:quotes
 const enrichedTransactions=tx.map(item=>{const category=cats.find(entry=>entry.id===item.categoryId);return {...item,categoryName:category?.name,categoryIcon:category?.icon,categoryImage:category?.imagePath}})
 return <FinanceDashboard currentDate={today} user={{name:current.user.name,email:current.user.email,image:current.user.image??null}} transactions={enrichedTransactions} categories={cats} goals={userGoals} budgets={userBudgets} holdings={userHoldings} quotes={marketIndicators} stockQuotes={stockQuotes}/>
}

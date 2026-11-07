import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets, categories, financialAccounts, goals, holdings, transactions, transfers, user } from '@/lib/db/schema'

/** Tira o dono de cada linha: o arquivo é todo do mesmo usuário. */
const withoutOwner = <T extends { userId: string }>(rows: T[]) =>
  rows.map((row) => {
    const copy: Partial<T> = { ...row }
    delete copy.userId
    return copy
  })

/**
 * Todos os dados financeiros do usuário em um JSON, para backup e portabilidade (LGPD).
 * Ficam de fora a senha, as sessões e os tokens de login.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const userId = session.user.id
  const [[profile], userCategories, accounts, userTransactions, userTransfers, userGoals, userBudgets, userHoldings] = await Promise.all([
    db.select({ name: user.name, email: user.email, createdAt: user.createdAt }).from(user).where(eq(user.id, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(financialAccounts).where(eq(financialAccounts.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(transactions.date, transactions.id),
    db.select().from(transfers).where(eq(transfers.userId, userId)).orderBy(transfers.date, transfers.id),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(budgets.month),
    db.select().from(holdings).where(eq(holdings.userId, userId)),
  ])
  const exportedAt = new Date()
  const body = {
    formato: 'clareza-v1',
    exportadoEm: exportedAt.toISOString(),
    observacao: 'Valores em centavos (amountCents 1990 = R$ 19,90). Datas no formato AAAA-MM-DD.',
    perfil: profile,
    categorias: withoutOwner(userCategories),
    contas: withoutOwner(accounts),
    lancamentos: withoutOwner(userTransactions),
    transferencias: withoutOwner(userTransfers),
    metas: withoutOwner(userGoals),
    orcamentos: withoutOwner(userBudgets),
    investimentos: withoutOwner(userHoldings),
  }
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(exportedAt)
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="clareza-dados-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

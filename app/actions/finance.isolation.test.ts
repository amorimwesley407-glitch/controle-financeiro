import { readdir, readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Teste de integração: roda as server actions contra um Postgres de verdade e confere
// que um usuário não consegue ler nem alterar dados de outro.
// Só roda com TEST_DATABASE_URL definida. O banco é APAGADO e recriado a cada execução.
const state = vi.hoisted(() => {
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  return { userId: null as string | null }
})

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/storage', () => ({ uploadImage: async () => null, removeImage: async () => {}, signImageUrls: async (v: unknown) => v }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => (state.userId ? { user: { id: state.userId } } : null) } },
}))

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const ALICE = 'user-alice'
const BOB = 'user-bob'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe.skipIf(!testDatabaseUrl)('isolamento entre usuários', () => {
  const sql = postgres(testDatabaseUrl ?? 'postgres://unused', { max: 1, onnotice: () => {} })
  let actions: typeof import('./finance')
  let bob: { categoryId: number; transactionId: number; goalId: number; budgetId: number; holdingId: number }
  let aliceTransactionId: number

  beforeAll(async () => {
    await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
    const dir = new URL('../../lib/db/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
      await sql.unsafe(await readFile(new URL(file, dir), 'utf8'))
    }
    actions = await import('./finance')
  })

  afterAll(async () => {
    await sql.end()
    const { client } = await import('@/lib/db')
    await client.end()
  })

  beforeEach(async () => {
    await sql`TRUNCATE "user" RESTART IDENTITY CASCADE`
    await sql`INSERT INTO "user" ("id", "name", "email") VALUES (${ALICE}, 'Alice', 'alice@teste.local'), (${BOB}, 'Bob', 'bob@teste.local')`
    const [category] = await sql`INSERT INTO "categories" ("userId", "name", "type") VALUES (${BOB}, 'Mercado', 'expense') RETURNING "id"`
    await sql`INSERT INTO "categories" ("userId", "name", "type") VALUES (${ALICE}, 'Transporte', 'expense')`
    const [transaction] = await sql`INSERT INTO "transactions" ("userId", "categoryId", "type", "description", "amountCents", "date") VALUES (${BOB}, ${category.id}, 'expense', 'Feira', 5000, '2026-10-01') RETURNING "id"`
    const [own] = await sql`INSERT INTO "transactions" ("userId", "type", "description", "amountCents", "date") VALUES (${ALICE}, 'expense', 'Ônibus', 450, '2026-10-01') RETURNING "id"`
    const [goal] = await sql`INSERT INTO "goals" ("userId", "name", "targetCents") VALUES (${BOB}, 'Viagem', 100000) RETURNING "id"`
    const [budget] = await sql`INSERT INTO "budgets" ("userId", "categoryId", "name", "limitCents", "month") VALUES (${BOB}, ${category.id}, 'Mercado', 80000, '2026-10') RETURNING "id"`
    const [holding] = await sql`INSERT INTO "holdings" ("userId", "symbol", "assetType", "quantity", "averageCostCents") VALUES (${BOB}, 'PETR4', 'stock', '10', 3500) RETURNING "id"`
    bob = { categoryId: category.id, transactionId: transaction.id, goalId: goal.id, budgetId: budget.id, holdingId: holding.id }
    aliceTransactionId = own.id
    state.userId = ALICE
  })

  const bobRows = async () => ({
    transaction: (await sql`SELECT "description", "amountCents", "categoryId" FROM "transactions" WHERE "id" = ${bob.transactionId}`)[0],
    category: (await sql`SELECT "name" FROM "categories" WHERE "id" = ${bob.categoryId}`)[0],
    goal: (await sql`SELECT "name", "targetCents" FROM "goals" WHERE "id" = ${bob.goalId}`)[0],
    budget: (await sql`SELECT "name", "limitCents" FROM "budgets" WHERE "id" = ${bob.budgetId}`)[0],
    holding: (await sql`SELECT "symbol", "quantity" FROM "holdings" WHERE "id" = ${bob.holdingId}`)[0],
  })

  it('bloqueia ações sem sessão', async () => {
    state.userId = null
    await expect(actions.addTransaction(form({ description: 'Teste', type: 'expense', date: '2026-10-02', amount: '10' }))).rejects.toThrow('Não autorizado')
    await expect(actions.deleteTransaction(bob.transactionId)).rejects.toThrow('Não autorizado')
  })

  it('não deixa alterar nem apagar os registros de outro usuário', async () => {
    const before = await bobRows()
    const attempts = [
      actions.updateTransaction(bob.transactionId, form({ description: 'Invadido', type: 'expense', date: '2026-10-01', amount: '1' })),
      actions.deleteTransaction(bob.transactionId),
      actions.updateCategory(bob.categoryId, form({ name: 'Invadido', type: 'expense' })),
      actions.deleteCategory(bob.categoryId),
      actions.updateGoal(bob.goalId, form({ name: 'Invadido', target: '1', current: '0', deadline: '' })),
      actions.deleteGoal(bob.goalId),
      actions.updateBudget(bob.budgetId, form({ name: 'Invadido', limit: '1', month: '2026-10', categoryId: String(bob.categoryId) })),
      actions.deleteBudget(bob.budgetId),
      actions.updateHolding(bob.holdingId, form({ assetType: 'stock', symbol: 'VALE3', quantity: '1', averageCost: '1' })),
      actions.deleteHolding(bob.holdingId),
    ]
    for (const attempt of attempts) await expect(attempt).rejects.toThrow()
    expect(await bobRows()).toEqual(before)
  })

  it('não deixa usar a categoria de outro usuário', async () => {
    await expect(actions.addTransaction(form({ description: 'Compra', type: 'expense', date: '2026-10-02', amount: '10', categoryId: String(bob.categoryId) }))).rejects.toThrow('Categoria inválida')
    await expect(actions.addBudget(form({ name: 'Mercado', limit: '100', month: '2026-10', categoryId: String(bob.categoryId) }))).rejects.toThrow('categoria de despesa válida')

    await actions.updateTransaction(aliceTransactionId, form({ description: 'Ônibus', type: 'expense', date: '2026-10-01', amount: '4,50', categoryId: String(bob.categoryId) }))
    const [own] = await sql`SELECT "categoryId" FROM "transactions" WHERE "id" = ${aliceTransactionId}`
    expect(own.categoryId).toBeNull()
  })

  it('importação cria categorias na conta de quem importa, sem reaproveitar as de outro usuário', async () => {
    await actions.importTransactions([{ description: 'Feira', type: 'expense', date: '2026-10-03', amountCents: 3000, categoryName: 'Mercado' }])
    const [imported] = await sql`SELECT t."userId", c."userId" AS "categoryOwner" FROM "transactions" t JOIN "categories" c ON c."id" = t."categoryId" WHERE t."description" = 'Feira' AND t."userId" = ${ALICE}`
    expect(imported).toEqual({ userId: ALICE, categoryOwner: ALICE })
  })

  it('importação pula lançamentos que já existem, mas só olhando os de quem importa', async () => {
    const rows = [
      { description: 'Feira', type: 'expense' as const, date: '2026-10-01', amountCents: 5000 },
      { description: 'ônibus', type: 'expense' as const, date: '2026-10-01', amountCents: 450 },
    ]
    expect(await actions.importTransactions(rows)).toMatchObject({ count: 1, skipped: 1 })
    expect(await actions.importTransactions(rows)).toMatchObject({ count: 0, skipped: 2 })
    const [{ count }] = await sql`SELECT count(*)::int FROM "transactions" WHERE "userId" = ${ALICE}`
    expect(count).toBe(2)
  })

  it('sugestão automática usa só as categorias de quem cadastra', async () => {
    await actions.addTransaction(form({ description: 'Mercado do mês', type: 'expense', date: '2026-10-04', amount: '200' }))
    await actions.addTransaction(form({ description: 'Uber', type: 'expense', date: '2026-10-04', amount: '20' }))
    const rows = await sql`SELECT t."description", c."userId" AS "categoryOwner", c."name" FROM "transactions" t LEFT JOIN "categories" c ON c."id" = t."categoryId" WHERE t."userId" = ${ALICE} AND t."date" = '2026-10-04' ORDER BY t."description"`
    expect(rows).toEqual([
      { description: 'Mercado do mês', categoryOwner: null, name: null },
      { description: 'Uber', categoryOwner: ALICE, name: 'Transporte' },
    ])
  })
})

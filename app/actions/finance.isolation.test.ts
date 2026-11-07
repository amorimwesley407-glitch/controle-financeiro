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
      () => actions.updateTransaction(bob.transactionId, form({ description: 'Invadido', type: 'expense', date: '2026-10-01', amount: '1' })),
      () => actions.deleteTransaction(bob.transactionId),
      () => actions.updateCategory(bob.categoryId, form({ name: 'Invadido', type: 'expense' })),
      () => actions.deleteCategory(bob.categoryId),
      () => actions.updateGoal(bob.goalId, form({ name: 'Invadido', target: '1', current: '0', deadline: '' })),
      () => actions.deleteGoal(bob.goalId),
      () => actions.updateBudget(bob.budgetId, form({ name: 'Invadido', limit: '1', month: '2026-10', categoryId: String(bob.categoryId) })),
      () => actions.deleteBudget(bob.budgetId),
      () => actions.updateHolding(bob.holdingId, form({ assetType: 'stock', symbol: 'VALE3', quantity: '1', averageCost: '1' })),
      () => actions.deleteHolding(bob.holdingId),
    ]
    for (const attempt of attempts) await expect(attempt()).rejects.toThrow()
    expect(await bobRows()).toEqual(before)
  })

  it('aprende a categoria com os lançamentos de quem cadastra, e nunca com os de outro usuário', async () => {
    const [{ id: lazer }] = await sql`INSERT INTO "categories" ("userId", "name", "type") VALUES (${ALICE}, 'Lazer', 'expense') RETURNING "id"`
    await sql`INSERT INTO "transactions" ("userId", "type", "description", "amountCents", "date", "categoryId") VALUES (${BOB}, 'expense', 'Clube da esquina', 100, '2026-10-01', ${bob.categoryId})`
    await actions.addTransaction(form({ description: 'Clube da esquina', type: 'expense', date: '2026-10-02', amount: '10' }))
    const category = async () => (await sql`SELECT "categoryId" FROM "transactions" WHERE "userId" = ${ALICE} AND "description" ILIKE 'clube%' ORDER BY "id" DESC LIMIT 1`)[0].categoryId
    expect(await category()).toBeNull()

    const [{ id }] = await sql`SELECT "id" FROM "transactions" WHERE "userId" = ${ALICE} AND "description" = 'Clube da esquina'`
    await actions.updateTransaction(id, form({ description: 'Clube da esquina', type: 'expense', date: '2026-10-02', amount: '10', categoryId: String(lazer) }))
    await actions.addTransaction(form({ description: 'CLUBE DA ESQUINA', type: 'expense', date: '2026-10-03', amount: '10' }))
    expect(await category()).toBe(lazer)
    await actions.importTransactions([{ description: 'clube da esquina', type: 'expense', date: '2026-10-04', amountCents: 500 }])
    expect(await category()).toBe(lazer)
  })

  it('guarda e altera as observações do lançamento', async () => {
    await actions.addTransaction(form({ description: 'Bolo', type: 'expense', date: '2026-10-02', amount: '10', notes: '  aniversário  ' }))
    const [row] = await sql`SELECT "id", "notes" FROM "transactions" WHERE "userId" = ${ALICE} AND "description" = 'Bolo'`
    expect(row.notes).toBe('aniversário')
    await actions.updateTransaction(row.id, form({ description: 'Bolo', type: 'expense', date: '2026-10-02', amount: '10', notes: '' }))
    expect((await sql`SELECT "notes" FROM "transactions" WHERE "id" = ${row.id}`)[0].notes).toBeNull()
    await expect(actions.addTransaction(form({ description: 'Bolo', type: 'expense', date: '2026-10-02', amount: '10', notes: 'x'.repeat(501) }))).rejects.toThrow()
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

  describe('contas, transferências e parcelas', () => {
    const group = '0f8b2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'
    let bobAccount: number
    let bobCard: number
    let aliceAccount: number
    let bobTransfer: number
    const bobAccountRows = async () => ({
      accounts: await sql`SELECT "id", "name", "initialBalanceCents" FROM "financial_accounts" WHERE "userId" = ${BOB} ORDER BY "id"`,
      transfers: await sql`SELECT "id", "amountCents" FROM "transfers" WHERE "userId" = ${BOB}`,
      installments: await sql`SELECT "id" FROM "transactions" WHERE "installmentGroup" = ${group}`,
    })

    beforeEach(async () => {
      ;[{ id: aliceAccount }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind") VALUES (${ALICE}, 'Conta', 'checking') RETURNING "id"`
      ;[{ id: bobAccount }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind") VALUES (${BOB}, 'Conta', 'checking') RETURNING "id"`
      ;[{ id: bobCard }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind", "closingDay", "dueDay") VALUES (${BOB}, 'Cartão', 'credit_card', 10, 20) RETURNING "id"`
      ;[{ id: bobTransfer }] = await sql`INSERT INTO "transfers" ("userId", "fromAccountId", "toAccountId", "amountCents", "date") VALUES (${BOB}, ${bobAccount}, ${bobCard}, 100, '2026-10-01') RETURNING "id"`
      await sql`INSERT INTO "transactions" ("userId", "type", "description", "amountCents", "date", "accountId", "installmentGroup", "installmentNumber", "installmentTotal") VALUES (${BOB}, 'expense', 'Parcela', 100, '2026-10-01', ${bobCard}, ${group}, 1, 2)`
    })

    it('não deixa alterar, apagar nem usar as contas de outro usuário', async () => {
      const before = await bobAccountRows()
      const attempts = [
        () => actions.updateAccount(bobAccount, form({ name: 'Invadida', kind: 'checking', initialBalance: '9' })),
        () => actions.deleteAccount(bobCard),
        () => actions.deleteTransfer(bobTransfer),
        () => actions.deleteInstallments(group),
        () => actions.addTransfer(form({ amount: '1', date: '2026-10-02', fromAccountId: String(aliceAccount), toAccountId: String(bobAccount) })),
        () => actions.addTransaction(form({ description: 'Compra', type: 'expense', date: '2026-10-02', amount: '10', accountId: String(bobAccount) })),
        () => actions.updateTransaction(aliceTransactionId, form({ description: 'Ônibus', type: 'expense', date: '2026-10-01', amount: '4,50', accountId: String(bobAccount) })),
      ]
      for (const attempt of attempts) await expect(attempt()).rejects.toThrow()
      expect(await bobAccountRows()).toEqual(before)
    })

    it('parcela no cartão com uma parcela por fatura e soma igual ao total', async () => {
      const [{ id: card }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind", "closingDay", "dueDay") VALUES (${ALICE}, 'Cartão', 'credit_card', 30, 10) RETURNING "id"`
      await actions.addTransaction(form({ description: 'Televisão', type: 'expense', date: '2027-01-31', amount: '100', accountId: String(card), installments: '3' }))
      const rows = await sql`SELECT "date", "amountCents" FROM "transactions" WHERE "accountId" = ${card} ORDER BY "date"`
      expect(rows).toEqual([
        { date: '2027-01-31', amountCents: 3334 },
        { date: '2027-03-01', amountCents: 3333 },
        { date: '2027-03-31', amountCents: 3333 },
      ])
    })

    it('lança só as parcelas que faltam de uma compra que já estava sendo paga', async () => {
      const [{ id: card }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind", "closingDay", "dueDay") VALUES (${ALICE}, 'Cartão', 'credit_card', 10, 20) RETURNING "id"`
      const rows = (description: string) => sql`SELECT "date", "amountCents", "installmentNumber", "installmentTotal" FROM "transactions" WHERE "accountId" = ${card} AND "description" = ${description} ORDER BY "date"`
      await actions.addTransaction(form({ description: 'Geladeira', type: 'expense', date: '2026-11-05', amount: '150', accountId: String(card), installments: '10', installmentStart: '4', amountMode: 'installment' }))
      const fridge = await rows('Geladeira')
      expect(fridge.map(row => [row.installmentNumber, row.installmentTotal, row.amountCents])).toEqual([4, 5, 6, 7, 8, 9, 10].map(number => [number, 10, 15000]))
      expect(fridge.map(row => row.date)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05', '2027-02-05', '2027-03-05', '2027-04-05', '2027-05-05'])

      await actions.addTransaction(form({ description: 'Sofá', type: 'expense', date: '2026-11-05', amount: '1000', accountId: String(card), installments: '10', installmentStart: '8' }))
      expect((await rows('Sofá')).map(row => [row.installmentNumber, row.amountCents])).toEqual([[8, 10000], [9, 10000], [10, 10000]])

      await expect(actions.addTransaction(form({ description: 'Mesa', type: 'expense', date: '2026-11-05', amount: '100', accountId: String(card), installments: '3', installmentStart: '4' }))).rejects.toThrow()
    })

    it('edita esta e as próximas parcelas levando só o que mudou', async () => {
      const [{ id: card }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind", "closingDay", "dueDay") VALUES (${ALICE}, 'Cartão', 'credit_card', 10, 20) RETURNING "id"`
      await actions.addTransaction(form({ description: 'Televisão', type: 'expense', date: '2026-11-05', amount: '100', accountId: String(card), installments: '3' }))
      const rows = () => sql`SELECT "id", "description", "amountCents", "date" FROM "transactions" WHERE "accountId" = ${card} ORDER BY "installmentNumber"`
      const [first, second] = await rows()
      const edit = (row: typeof second, fields: Record<string, string>) =>
        actions.updateTransaction(row.id, form({ description: row.description, type: 'expense', date: row.date, amount: (row.amountCents / 100).toFixed(2), accountId: String(card), ...fields }))

      await edit(second, { description: 'TV da sala', date: '2026-12-08', scope: 'following' })
      expect((await rows()).map(row => [row.description, row.amountCents, row.date])).toEqual([
        ['Televisão', 3334, '2026-11-05'],
        ['TV da sala', 3333, '2026-12-08'],
        ['TV da sala', 3333, '2027-01-05'],
      ])

      await edit({ ...second, description: 'TV da sala' }, { amount: '40', scope: 'following' })
      await edit(first, { amount: '50', scope: 'this' })
      expect((await rows()).map(row => row.amountCents)).toEqual([5000, 4000, 4000])

      await expect(edit(first, { recurring: 'true', recurrenceEnd: '2027-06-01' })).rejects.toThrow('recorrente')
    })

    it('guarda o limite só em cartões e recusa limite zerado', async () => {
      const limitOf = async (name: string) => (await sql`SELECT "creditLimitCents" FROM "financial_accounts" WHERE "userId" = ${ALICE} AND "name" = ${name}`)[0].creditLimitCents
      await actions.addAccount(form({ name: 'Nubank', kind: 'credit_card', closingDay: '10', dueDay: '20', creditLimit: '5000,50' }))
      expect(await limitOf('Nubank')).toBe(500050)
      await actions.addAccount(form({ name: 'Inter', kind: 'credit_card', closingDay: '10', dueDay: '20', creditLimit: '' }))
      expect(await limitOf('Inter')).toBeNull()
      await actions.addAccount(form({ name: 'Corrente', kind: 'checking', creditLimit: '1000' }))
      expect(await limitOf('Corrente')).toBeNull()
      await expect(actions.addAccount(form({ name: 'Zerado', kind: 'credit_card', closingDay: '10', dueDay: '20', creditLimit: '0' }))).rejects.toThrow()
    })

    it('divide um lançamento entre categorias do próprio usuário, com a soma igual ao original', async () => {
      const [{ id: transporte }] = await sql`SELECT "id" FROM "categories" WHERE "userId" = ${ALICE} AND "name" = 'Transporte'`
      const [{ id: limpeza }] = await sql`INSERT INTO "categories" ("userId", "name", "type") VALUES (${ALICE}, 'Limpeza', 'expense') RETURNING "id"`
      const [{ id }] = await sql`INSERT INTO "transactions" ("userId", "type", "description", "amountCents", "date", "accountId", "notes") VALUES (${ALICE}, 'expense', 'Mercado', 10000, '2026-10-03', ${aliceAccount}, 'nota') RETURNING "id"`
      await expect(actions.splitTransaction(id, [{ categoryId: transporte, amountCents: 7000 }, { categoryId: limpeza, amountCents: 2999 }])).rejects.toThrow('somar')
      await expect(actions.splitTransaction(id, [{ categoryId: transporte, amountCents: 7000 }, { categoryId: bob.categoryId, amountCents: 3000 }])).rejects.toThrow('Categoria inválida')
      await expect(actions.splitTransaction(bob.transactionId, [{ categoryId: null, amountCents: 2500 }, { categoryId: null, amountCents: 2500 }])).rejects.toThrow('não encontrada')

      await actions.splitTransaction(id, [{ categoryId: transporte, amountCents: 7000 }, { categoryId: limpeza, amountCents: 2000 }, { categoryId: null, amountCents: 1000 }])
      const parts = await sql`SELECT "description", "date", "accountId", "notes", "categoryId", "amountCents" FROM "transactions" WHERE "userId" = ${ALICE} AND "description" = 'Mercado' ORDER BY "amountCents" DESC`
      expect(parts).toEqual([
        { description: 'Mercado', date: '2026-10-03', accountId: aliceAccount, notes: 'nota', categoryId: transporte, amountCents: 7000 },
        { description: 'Mercado', date: '2026-10-03', accountId: aliceAccount, notes: 'nota', categoryId: limpeza, amountCents: 2000 },
        { description: 'Mercado', date: '2026-10-03', accountId: aliceAccount, notes: 'nota', categoryId: null, amountCents: 1000 },
      ])
      const [{ id: installment }] = await sql`INSERT INTO "transactions" ("userId", "type", "description", "amountCents", "date", "installmentGroup", "installmentNumber", "installmentTotal") VALUES (${ALICE}, 'expense', 'TV', 1000, '2026-10-03', ${'1f8b2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'}, 1, 2) RETURNING "id"`
      await expect(actions.splitTransaction(installment, [{ categoryId: null, amountCents: 500 }, { categoryId: null, amountCents: 500 }])).rejects.toThrow('Parcelas')
    })

    it('compra dividida fica agrupada: refaz a divisão, junta de novo e exclui inteira', async () => {
      const [{ id: transporte }] = await sql`SELECT "id" FROM "categories" WHERE "userId" = ${ALICE} AND "name" = 'Transporte'`
      const [{ id }] = await sql`INSERT INTO "transactions" ("userId", "type", "description", "amountCents", "date") VALUES (${ALICE}, 'expense', 'Feira', 9000, '2026-10-04') RETURNING "id"`
      const parts = () => sql`SELECT "id", "amountCents", "categoryId", "splitGroup", "description", "date" FROM "transactions" WHERE "userId" = ${ALICE} AND "description" IN ('Feira', 'Feira livre') ORDER BY "id"`
      await actions.splitTransaction(id, [{ categoryId: null, amountCents: 6000 }, { categoryId: transporte, amountCents: 3000 }])
      const first = await parts()
      const group = first[0].splitGroup
      expect(group).toMatch(/^[0-9a-f-]{36}$/)
      expect(first.map(row => [row.amountCents, row.splitGroup])).toEqual([[6000, group], [3000, group]])

      // Refazer a partir de qualquer parte usa o total da compra e mantém o grupo.
      await expect(actions.splitTransaction(first[1].id, [{ categoryId: null, amountCents: 3000 }, { categoryId: null, amountCents: 3000 }])).rejects.toThrow('somar')
      await actions.splitTransaction(first[1].id, [{ categoryId: null, amountCents: 4000 }, { categoryId: transporte, amountCents: 3000 }, { categoryId: null, amountCents: 2000 }])
      const second = await parts()
      expect(second.map(row => row.amountCents)).toEqual([4000, 3000, 2000])
      expect(second[0].id).toBe(id)
      expect(new Set(second.map(row => row.splitGroup))).toEqual(new Set([group]))

      // Editar uma parte muda descrição e data de todas, mas não o valor nem a categoria.
      await actions.updateTransaction(second[1].id, form({ description: 'Feira livre', type: 'expense', date: '2026-10-05', amount: '999', categoryId: 'none' }))
      expect((await parts()).map(row => [row.description, row.date, row.amountCents, row.categoryId])).toEqual([
        ['Feira livre', '2026-10-05', 4000, null], ['Feira livre', '2026-10-05', 3000, transporte], ['Feira livre', '2026-10-05', 2000, null],
      ])

      // Outro usuário não mexe no grupo.
      state.userId = BOB
      await expect(actions.joinSplit(group)).rejects.toThrow('não encontrado')
      await expect(actions.deleteSplit(group)).rejects.toThrow('não encontrado')
      state.userId = ALICE
      expect(await parts()).toHaveLength(3)

      await actions.joinSplit(group)
      expect((await parts()).map(row => [row.id, row.amountCents, row.splitGroup])).toEqual([[id, 9000, null]])

      await actions.splitTransaction(id, [{ categoryId: null, amountCents: 5000 }, { categoryId: null, amountCents: 4000 }])
      await actions.deleteSplit((await parts())[0].splitGroup)
      expect(await parts()).toHaveLength(0)
    })
  })

  it('copia os orçamentos do mês anterior só do próprio usuário, sem duplicar', async () => {
    const [{ id: lazer }] = await sql`INSERT INTO "categories" ("userId", "name", "type") VALUES (${ALICE}, 'Lazer', 'expense') RETURNING "id"`
    const [{ id: transporte }] = await sql`SELECT "id" FROM "categories" WHERE "userId" = ${ALICE} AND "name" = 'Transporte'`
    await sql`INSERT INTO "budgets" ("userId", "categoryId", "name", "limitCents", "month") VALUES (${ALICE}, ${lazer}, 'Lazer', 30000, '2026-10'), (${ALICE}, ${transporte}, 'Transporte', 20000, '2026-10'), (${ALICE}, ${transporte}, 'Transporte', 25000, '2026-11')`
    expect(await actions.copyBudgets('2026-10', '2026-11')).toBe(1)
    expect(await actions.copyBudgets('2026-10', '2026-11')).toBe(0)
    const november = await sql`SELECT "name", "limitCents" FROM "budgets" WHERE "userId" = ${ALICE} AND "month" = '2026-11' ORDER BY "name"`
    expect(november).toEqual([{ name: 'Lazer', limitCents: 30000 }, { name: 'Transporte', limitCents: 25000 }])
    const [{ count }] = await sql`SELECT count(*)::int FROM "budgets" WHERE "userId" = ${BOB}`
    expect(count).toBe(1)
    await expect(actions.copyBudgets('2026-10', '2026-10')).rejects.toThrow()
  })

  it('importa em uma conta do próprio usuário e deixa de fora o pagamento da fatura do cartão', async () => {
    const [{ id: card }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind", "closingDay", "dueDay") VALUES (${ALICE}, 'Cartão', 'credit_card', 10, 20) RETURNING "id"`
    const [{ id: bobAccount }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind") VALUES (${BOB}, 'Conta', 'checking') RETURNING "id"`
    const rows = [
      { description: 'Padaria', type: 'expense' as const, date: '2026-10-05', amountCents: 1200 },
      { description: 'Estorno Loja', type: 'income' as const, date: '2026-10-06', amountCents: 500 },
      { description: 'Pagamento recebido', type: 'income' as const, date: '2026-10-07', amountCents: 9000 },
    ]
    await expect(actions.importTransactions(rows, bobAccount)).rejects.toThrow('Conta inválida')
    expect(await actions.importTransactions(rows, card)).toMatchObject({ count: 2, cardPayments: 1 })
    const imported = await sql`SELECT "description", "accountId" FROM "transactions" WHERE "userId" = ${ALICE} AND "date" >= '2026-10-05' ORDER BY "date"`
    expect(imported).toEqual([{ description: 'Padaria', accountId: card }, { description: 'Estorno Loja', accountId: card }])
  })

  it('contas a pagar: cria pendente, marca como paga só as próprias e mantém o status ao editar', async () => {
    const [{ id: card }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind", "closingDay", "dueDay") VALUES (${ALICE}, 'Cartão', 'credit_card', 10, 20) RETURNING "id"`
    const statusOf = async (description: string) => (await sql`SELECT "billStatus" FROM "transactions" WHERE "userId" = ${ALICE} AND "description" = ${description} ORDER BY "date"`).map(row => row.billStatus)
    await actions.addTransaction(form({ description: 'Luz', type: 'expense', date: '2026-11-10', amount: '200', bill: 'true', recurring: 'true', recurrenceEnd: '2027-01-10' }))
    expect(await statusOf('Luz')).toEqual(['pending', 'pending', 'pending'])
    await actions.addTransaction(form({ description: 'Loja', type: 'expense', date: '2026-11-10', amount: '50', bill: 'true', accountId: String(card) }))
    await actions.addTransaction(form({ description: 'Bônus', type: 'income', date: '2026-11-10', amount: '50', bill: 'true' }))
    expect([...(await statusOf('Loja')), ...(await statusOf('Bônus'))]).toEqual([null, null])

    const [light] = await sql`SELECT "id" FROM "transactions" WHERE "userId" = ${ALICE} AND "description" = 'Luz' ORDER BY "date" LIMIT 1`
    await actions.setBillPaid(light.id, true)
    await actions.updateTransaction(light.id, form({ description: 'Conta de luz', type: 'expense', date: '2026-11-10', amount: '210', bill: 'true' }))
    expect((await statusOf('Conta de luz'))).toEqual(['paid'])
    await actions.updateTransaction(light.id, form({ description: 'Conta de luz', type: 'expense', date: '2026-11-10', amount: '210' }))
    expect((await statusOf('Conta de luz'))).toEqual([null])

    const [bobBill] = await sql`INSERT INTO "transactions" ("userId", "type", "description", "amountCents", "date", "billStatus") VALUES (${BOB}, 'expense', 'Aluguel', 100000, '2026-11-05', 'pending') RETURNING "id"`
    await expect(actions.setBillPaid(bobBill.id, true)).rejects.toThrow('não encontrada')
    await expect(actions.setBillPaid(aliceTransactionId, true)).rejects.toThrow('não encontrada')
    expect((await sql`SELECT "billStatus" FROM "transactions" WHERE "id" = ${bobBill.id}`)[0].billStatus).toBe('pending')
  })

  it('exporta só os dados de quem pede, sem senha nem dono das linhas', async () => {
    await sql`INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password") VALUES ('acc-alice', ${ALICE}, 'credential', ${ALICE}, 'hash-secreto')`
    const { GET } = await import('../api/export/route')
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="clareza-dados-\d{4}-\d{2}-\d{2}\.json"/)
    const text = await response.text()
    expect(text).not.toContain('hash-secreto')
    expect(text).not.toContain(BOB)
    expect(text).not.toContain('Feira')
    const data = JSON.parse(text)
    expect(data.perfil.email).toBe('alice@teste.local')
    expect(data.lancamentos.map((item: { description: string }) => item.description)).toEqual(['Ônibus'])
    expect(data.lancamentos[0]).not.toHaveProperty('userId')
    state.userId = null
    expect((await GET()).status).toBe(401)
  })

  describe('metas ligadas a contas e aparência do cartão', () => {
    const goalForm = (fields: Record<string, string>) => form({ name: 'Reserva', target: '1000', current: '0', deadline: '', ...fields })

    it('liga a meta só a uma conta do próprio usuário, e nunca a um cartão', async () => {
      const [{ id: bobAccount }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind") VALUES (${BOB}, 'Poupança', 'savings') RETURNING "id"`
      const [{ id: card }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind", "closingDay", "dueDay") VALUES (${ALICE}, 'Cartão', 'credit_card', 10, 20) RETURNING "id"`
      const [{ id: mine }] = await sql`INSERT INTO "financial_accounts" ("userId", "name", "kind") VALUES (${ALICE}, 'Poupança', 'savings') RETURNING "id"`
      await expect(actions.addGoal(goalForm({ accountId: String(bobAccount) }))).rejects.toThrow('Conta inválida')
      await expect(actions.addGoal(goalForm({ accountId: String(card) }))).rejects.toThrow('cartão')

      await actions.addGoal(form({ name: 'Reserva', target: '1000', deadline: '', accountId: String(mine) }))
      const [goal] = await sql`SELECT "id", "accountId", "currentCents" FROM "goals" WHERE "userId" = ${ALICE}`
      expect(goal).toMatchObject({ accountId: mine, currentCents: 0 })

      await expect(actions.updateGoal(goal.id, goalForm({ accountId: String(bobAccount) }))).rejects.toThrow('Conta inválida')
      await actions.updateGoal(goal.id, goalForm({ current: '50' }))
      expect((await sql`SELECT "accountId", "currentCents" FROM "goals" WHERE "id" = ${goal.id}`)[0]).toEqual({ accountId: null, currentCents: 5000 })
    })

    it('salva a aparência do cartão e recusa número completo ou valores desconhecidos', async () => {
      const card = (fields: Record<string, string>) => form({ name: 'Roxinho', kind: 'credit_card', initialBalance: '', closingDay: '10', dueDay: '20', ...fields })
      await actions.addAccount(card({ cardBrand: 'mastercard', cardColor: 'nubank', cardLastDigits: '1234' }))
      expect((await sql`SELECT "cardBrand", "cardColor", "cardLastDigits" FROM "financial_accounts" WHERE "name" = 'Roxinho'`)[0]).toEqual({ cardBrand: 'mastercard', cardColor: 'nubank', cardLastDigits: '1234' })
      await expect(actions.addAccount(card({ name: 'Outro', cardLastDigits: '4111111111111111' }))).rejects.toThrow()
      await expect(actions.addAccount(card({ name: 'Outro', cardBrand: 'banana' }))).rejects.toThrow()
      await expect(actions.addAccount(card({ name: 'Outro', cardColor: 'banana' }))).rejects.toThrow()
    })
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

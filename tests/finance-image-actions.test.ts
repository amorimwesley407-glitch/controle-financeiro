import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import type { StoredImageProvenance } from '@/lib/storage'

process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/test'
process.env.BETTER_AUTH_SECRET ??= 'test-secret-with-at-least-32-characters'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
process.env.SUPABASE_STORAGE_BUCKET = 'finance-uploads'

const uuid = '123e4567-e89b-12d3-a456-426614174000'
const reference = (owner: string) => `supabase-storage://finance-uploads/${owner}/profile-images/${uuid}.jpg`
const legacyTransaction = 'https://project.supabase.co/storage/v1/object/public/finance-uploads/legacy/transaction-images/old_file-1.png'

function valuesIn(value: unknown, seen = new WeakSet<object>()): unknown[] {
  if (value === null || typeof value !== 'object') return [value]
  if (seen.has(value)) return []
  seen.add(value)
  return Object.values(value).flatMap(item => valuesIn(item, seen))
}

function mutationResult(returning = [{ id: 1 }]) {
  const promise = Promise.resolve(undefined)
  return {
    returning: async () => returning,
    then: promise.then.bind(promise),
  }
}

async function installHarness(
  t: TestContext,
  row: Record<string, unknown>,
  sessionUserId = 'B',
) {
  const [{ db }, { financeImageActionRuntime }, storage] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/finance-action-runtime'),
    import('@/lib/storage'),
  ])
  const events: string[] = []
  const queryValues: unknown[][] = []
  const storageCalls = { created: 0, removed: [] as string[][] }
  const operations = storage.createStorageAuthorizationOperations(() => {
    storageCalls.created++
    return {
      from: () => ({
        createSignedUrls: async () => ({ data: [], error: null }),
        remove: async (paths: string[]) => { storageCalls.removed.push(paths); return { error: null } },
      }),
    }
  })

  t.mock.method(financeImageActionRuntime, 'getUserId', async () => sessionUserId)
  t.mock.method(financeImageActionRuntime, 'createStoredImageProvenance', storage.createStoredImageProvenance)
  t.mock.method(financeImageActionRuntime, 'prepareStoredImageRemovalForUser', (userId: string, provenance: StoredImageProvenance) => {
    events.push('authorize')
    return storage.prepareStoredImageRemovalForUser(userId, provenance)
  })
  t.mock.method(financeImageActionRuntime, 'removePreparedImages', operations.removePreparedImages)
  t.mock.method(financeImageActionRuntime, 'revalidatePath', () => undefined)
  t.mock.method(db, 'select', (() => ({
    from: () => ({
      where: (condition: unknown) => {
        queryValues.push(valuesIn(condition))
        return { limit: async () => [row] }
      },
    }),
  })) as never)
  t.mock.method(db, 'update', (() => ({
    set: () => ({
      where: () => { events.push('mutation'); return mutationResult() },
    }),
  })) as never)
  t.mock.method(db, 'delete', (() => ({
    where: () => { events.push('mutation'); return mutationResult() },
  })) as never)

  return { events, queryValues, storageCalls }
}

function transactionForm() {
  const form = new FormData()
  form.set('description', 'Teste seguro')
  form.set('type', 'expense')
  form.set('date', '2026-09-16')
  form.set('amount', '10.00')
  form.set('categoryId', 'none')
  form.set('removeImage', 'true')
  return form
}

function categoryForm() {
  const form = new FormData()
  form.set('name', 'Categoria segura')
  form.set('type', 'expense')
  form.set('icon', 'wallet')
  form.set('removeImage', 'true')
  return form
}

test('updateUserProfile usa sessão B, autoriza antes da mutação e não remove imagem de A', async t => {
  const harness = await installHarness(t, { id: 'B', image: reference('A') })
  const { updateUserProfile } = await import('@/app/actions/finance')
  const form = new FormData()
  form.set('name', 'Usuário B')
  form.set('removeImage', 'true')
  await updateUserProfile(form)
  assert.ok(harness.queryValues.every(values => values.includes('B') && !values.includes('A')))
  assert.ok(harness.events.indexOf('authorize') < harness.events.indexOf('mutation'))
  assert.deepEqual(harness.storageCalls, { created: 0, removed: [] })
})

test('updateTransaction usa sessão B, autoriza antes da mutação e não remove imagem de A', async t => {
  const harness = await installHarness(t, { id: 7, userId: 'B', imagePath: reference('A') })
  const { updateTransaction } = await import('@/app/actions/finance')
  await updateTransaction(7, transactionForm())
  assert.ok(harness.queryValues.every(values => values.includes('B') && !values.includes('A')))
  assert.ok(harness.events.indexOf('authorize') < harness.events.indexOf('mutation'))
  assert.deepEqual(harness.storageCalls, { created: 0, removed: [] })
})

test('deleteTransaction usa sessão B, autoriza antes da mutação e não remove imagem de A', async t => {
  const harness = await installHarness(t, { id: 7, userId: 'B', imagePath: reference('A') })
  const { deleteTransaction } = await import('@/app/actions/finance')
  await deleteTransaction(7)
  assert.ok(harness.queryValues.every(values => values.includes('B') && !values.includes('A')))
  assert.ok(harness.events.indexOf('authorize') < harness.events.indexOf('mutation'))
  assert.deepEqual(harness.storageCalls, { created: 0, removed: [] })
})

test('deleteTransaction permite que A remova sua própria imagem e envia o path exato ao Storage', async t => {
  const harness = await installHarness(t, { id: 7, userId: 'A', imagePath: reference('A') }, 'A')
  const { deleteTransaction } = await import('@/app/actions/finance')
  await deleteTransaction(7)
  assert.ok(harness.queryValues.every(values => values.includes('A')))
  assert.ok(harness.events.indexOf('authorize') < harness.events.indexOf('mutation'))
  assert.deepEqual(harness.storageCalls.removed, [[`A/profile-images/${uuid}.jpg`]])
})

test('deleteTransaction remove legacy somente após consulta do registro da sessão', async t => {
  const harness = await installHarness(t, { id: 7, userId: 'B', imagePath: legacyTransaction })
  const { deleteTransaction } = await import('@/app/actions/finance')
  await deleteTransaction(7)
  assert.ok(harness.queryValues.every(values => values.includes('B')))
  assert.ok(harness.events.indexOf('authorize') < harness.events.indexOf('mutation'))
  assert.deepEqual(harness.storageCalls.removed, [['legacy/transaction-images/old_file-1.png']])
})

test('updateCategory usa sessão B, autoriza antes da mutação e não remove imagem de A', async t => {
  const harness = await installHarness(t, { id: 4, userId: 'B', imagePath: reference('A') })
  const { updateCategory } = await import('@/app/actions/finance')
  await updateCategory(4, categoryForm())
  assert.ok(harness.queryValues.every(values => values.includes('B') && !values.includes('A')))
  assert.ok(harness.events.indexOf('authorize') < harness.events.indexOf('mutation'))
  assert.deepEqual(harness.storageCalls, { created: 0, removed: [] })
})

test('deleteCategory usa sessão B, autoriza antes das mutações e não remove imagem de A', async t => {
  const harness = await installHarness(t, { id: 4, userId: 'B', imagePath: reference('A') })
  const { deleteCategory } = await import('@/app/actions/finance')
  await deleteCategory(4)
  assert.ok(harness.queryValues.every(values => values.includes('B') && !values.includes('A')))
  assert.ok(harness.events.indexOf('authorize') < harness.events.indexOf('mutation'))
  assert.deepEqual(harness.storageCalls, { created: 0, removed: [] })
})

test('ausência de sessão não consulta banco nem executa Storage', async t => {
  const [{ db }, { financeImageActionRuntime }, { deleteTransaction }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/finance-action-runtime'),
    import('@/app/actions/finance'),
  ])
  let privilegedCalls = 0
  t.mock.method(financeImageActionRuntime, 'getUserId', async () => { throw new Error('Não autorizado') })
  t.mock.method(financeImageActionRuntime, 'removePreparedImages', async () => { privilegedCalls++ })
  t.mock.method(db, 'select', (() => { privilegedCalls++; throw new Error('não deveria consultar') }) as never)
  await assert.rejects(deleteTransaction(7), /Não autorizado/)
  assert.equal(privilegedCalls, 0)
})

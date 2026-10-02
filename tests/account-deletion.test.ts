import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/test'
process.env.SUPABASE_STORAGE_BUCKET = 'finance-uploads'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'

const uuid = '123e4567-e89b-12d3-a456-426614174000'
const reference = (owner: string) => `supabase-storage://finance-uploads/${owner}/profile-images/${uuid}.jpg`
const legacy = (folder: string) => `https://project.supabase.co/storage/v1/object/public/finance-uploads/legacy/${folder}/old_file-1.png`

test('beforeDelete remove somente arquivos de B e continua com referências alheias ou inválidas', async () => {
  const [{ createAccountDeletionCleanup }, { createStorageAuthorizationOperations, createStoredImageProvenance }] = await Promise.all([
    import('@/lib/account-deletion'),
    import('@/lib/storage'),
  ])
  const removed: string[][] = []
  const operations = createStorageAuthorizationOperations(() => ({
    from: () => ({
      createSignedUrls: async () => ({ data: [], error: null }),
      remove: async (paths: string[]) => { removed.push(paths); return { error: null } },
    }),
  }))
  const events: string[] = []
  const cleanup = createAccountDeletionCleanup({
    loadCategoryImages: async userId => { assert.equal(userId, 'B'); return [
      createStoredImageProvenance('A', reference('A')),
      createStoredImageProvenance('B', reference('B')),
    ] },
    loadTransactionImages: async userId => { assert.equal(userId, 'B'); return [
      createStoredImageProvenance('B', 'invalid'),
      createStoredImageProvenance('B', '/uploads/profile-images/legacy.jpg'),
    ] },
    removeImages: async (userId, values) => { events.push('storage'); await operations.removeStoredImagesForUser(userId, values) },
    deleteFinancialData: async userId => { events.push('database'); assert.equal(userId, 'B') },
  })

  await assert.doesNotReject(cleanup({ id: 'B', image: reference('A') }))
  assert.deepEqual(removed, [[`B/profile-images/${uuid}.jpg`]])
  assert.deepEqual(events, ['storage', 'database'])
})

test('beforeDelete aceita legacy próprio por provenance, ignora provenance estrangeira e continua', async () => {
  const [{ createAccountDeletionCleanup }, { createStorageAuthorizationOperations, createStoredImageProvenance }] = await Promise.all([
    import('@/lib/account-deletion'),
    import('@/lib/storage'),
  ])
  const removed: string[][] = []
  const operations = createStorageAuthorizationOperations(() => ({
    from: () => ({
      createSignedUrls: async () => ({ data: [], error: null }),
      remove: async (paths: string[]) => { removed.push(paths); return { error: null } },
    }),
  }))
  let databaseDeleted = false
  const cleanup = createAccountDeletionCleanup({
    loadCategoryImages: async () => [createStoredImageProvenance('B', legacy('category-icons'))],
    loadTransactionImages: async () => [createStoredImageProvenance('A', legacy('transaction-images'))],
    removeImages: operations.removeStoredImagesForUser,
    deleteFinancialData: async userId => { assert.equal(userId, 'B'); databaseDeleted = true },
  })

  await cleanup({ id: 'B', image: legacy('profile-images') })
  assert.deepEqual(removed, [[
    'legacy/category-icons/old_file-1.png',
    'legacy/profile-images/old_file-1.png',
  ]])
  assert.equal(databaseDeleted, true)
})

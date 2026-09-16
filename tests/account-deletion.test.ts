import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/test'
process.env.SUPABASE_STORAGE_BUCKET = 'finance-uploads'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'

const uuid = '123e4567-e89b-12d3-a456-426614174000'
const reference = (owner: string) => `supabase-storage://finance-uploads/${owner}/profile-images/${uuid}.jpg`

test('beforeDelete remove somente arquivos de B e continua com referências alheias ou inválidas', async () => {
  const [{ createAccountDeletionCleanup }, { createStorageAuthorizationOperations }] = await Promise.all([
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
    loadCategoryImages: async userId => { assert.equal(userId, 'B'); return [reference('A'), reference('B')] },
    loadTransactionImages: async userId => { assert.equal(userId, 'B'); return ['invalid', '/uploads/profile-images/legacy.jpg'] },
    removeImages: async (userId, values) => { events.push('storage'); await operations.removeImagesForUser(userId, values) },
    deleteFinancialData: async userId => { events.push('database'); assert.equal(userId, 'B') },
  })

  await assert.doesNotReject(cleanup({ id: 'B', image: reference('A') }))
  assert.deepEqual(removed, [[`B/profile-images/${uuid}.jpg`]])
  assert.deepEqual(events, ['storage', 'database'])
})

import assert from 'node:assert/strict'
import test from 'node:test'

process.env.SUPABASE_STORAGE_BUCKET = 'finance-uploads'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'

const storageModule = import('@/lib/storage')
const uuid = '123e4567-e89b-12d3-a456-426614174000'
const reference = (owner: string) => `supabase-storage://finance-uploads/${owner}/profile-images/${uuid}.jpg`
const legacy = (folder = 'category-icons') => `https://project.supabase.co/storage/v1/object/public/finance-uploads/legacy/${folder}/old_file-1.png`

async function storageMock(existing = new Set<string>()) {
  const { createStorageAuthorizationOperations } = await storageModule
  const calls = { created: 0, signed: [] as string[][], removed: [] as string[][] }
  const operations = createStorageAuthorizationOperations(() => {
    calls.created++
    return {
      from: () => ({
        createSignedUrls: async (paths: string[]) => {
          calls.signed.push(paths)
          return { data: paths.map(path => existing.has(path) ? { signedUrl: `https://signed.invalid/${path}` } : {}), error: null }
        },
        remove: async (paths: string[]) => {
          calls.removed.push(paths)
          return { error: null }
        },
      }),
    }
  })
  return { calls, operations }
}

test('A assina e remove arquivo próprio', async () => {
  const { prepareImageRemovalForUser } = await storageModule
  const path = `A/profile-images/${uuid}.jpg`
  const { calls, operations } = await storageMock(new Set([path]))
  const urls = await operations.signImageUrlsForUser('A', [reference('A')])
  await operations.removePreparedImages([prepareImageRemovalForUser('A', reference('A'))])
  assert.match(urls.get(reference('A')) ?? '', /^https:\/\/signed\.invalid\//)
  assert.deepEqual(calls.signed, [[path]])
  assert.deepEqual(calls.removed, [[path]])
})

test('B não assina nem remove arquivo de A e o cliente Storage não é criado', async () => {
  const { prepareImageRemovalForUser } = await storageModule
  const { calls, operations } = await storageMock()
  const urls = await operations.signImageUrlsForUser('B', [reference('A')])
  await operations.removePreparedImages([prepareImageRemovalForUser('B', reference('A'))])
  assert.equal(urls.size, 0)
  assert.deepEqual(calls, { created: 0, signed: [], removed: [] })
})

test('nenhuma entrada controlável por B envia objeto de A para assinatura ou remoção', async () => {
  const { prepareImageRemovalForUser } = await storageModule
  const ownPath = `B/profile-images/${uuid}.jpg`
  const inputs = [
    reference('A'),
    `https://project.supabase.co/storage/v1/object/public/finance-uploads/A/profile-images/${uuid}.jpg`,
    'supabase-storage://finance-uploads/B/../A/file.jpg',
    `/uploads/profile-images/A-${uuid}.jpg`,
    reference('B'),
  ]
  const { calls, operations } = await storageMock(new Set([ownPath]))
  const urls = await operations.signImageUrlsForUser('B', inputs)
  const removals = inputs.map(value => prepareImageRemovalForUser('B', value))
  await operations.removePreparedImages(removals)

  assert.deepEqual(calls.signed, [[ownPath]])
  assert.deepEqual(calls.removed, [[ownPath]])
  assert.equal(calls.signed.flat().some(path => path.startsWith('A/')), false)
  assert.equal(calls.removed.flat().some(path => path.startsWith('A/')), false)
  assert.equal(urls.has(reference('A')), false)
  assert.equal(urls.get(`/uploads/profile-images/A-${uuid}.jpg`), `/uploads/profile-images/A-${uuid}.jpg`)
})

test('referências inválida, local e alheia nunca criam cliente Storage', async () => {
  const { prepareImageRemovalForUser } = await storageModule
  const { calls, operations } = await storageMock()
  const values = ['/uploads/profile-images/legacy.jpg', 'unknown', reference('A')]
  const urls = await operations.signImageUrlsForUser('B', values)
  await operations.removePreparedImages(values.map(value => prepareImageRemovalForUser('B', value)))
  assert.equal(urls.get('/uploads/profile-images/legacy.jpg'), '/uploads/profile-images/legacy.jpg')
  assert.deepEqual(calls, { created: 0, signed: [], removed: [] })
})

test('arquivo próprio inexistente não produz URL nem acesso a outro objeto', async () => {
  const ownPath = `B/profile-images/${uuid}.jpg`
  const { calls, operations } = await storageMock()
  const urls = await operations.signImageUrlsForUser('B', [reference('B')])
  await operations.removeImagesForUser('B', [reference('B')])
  assert.equal(urls.has(reference('B')), false)
  assert.deepEqual(calls.signed, [[ownPath]])
  assert.deepEqual(calls.removed, [[ownPath]])
})

test('identidade vazia não permite operação privilegiada', async () => {
  const { prepareImageRemovalForUser } = await storageModule
  const { calls, operations } = await storageMock()
  await operations.signImageUrlsForUser('', [reference('A')])
  await operations.removePreparedImages([prepareImageRemovalForUser('', reference('A'))])
  assert.equal(calls.created, 0)
})

test('exclusão de B ignora user.image de A e pode continuar', async () => {
  const { calls, operations } = await storageMock()
  await assert.doesNotReject(operations.removeImagesForUser('B', [reference('A'), 'unknown', '/uploads/profile-images/legacy.jpg']))
  assert.deepEqual(calls, { created: 0, signed: [], removed: [] })
})

test('objeto estrutural fabricado não constitui autorização de remoção', async () => {
  const { calls, operations } = await storageMock()
  const forged = {
    kind: 'private-storage',
    value: reference('A'),
    objectPath: `A/profile-images/${uuid}.jpg`,
    ownerId: 'A',
    folder: 'profile-images',
    fileName: `${uuid}.jpg`,
  }
  await operations.removePreparedImages([forged as never])
  assert.deepEqual(calls, { created: 0, signed: [], removed: [] })
})

test('legacy de perfil, categoria e transação é assinado somente com provenance própria do banco', async () => {
  const { createStoredImageProvenance } = await storageModule
  const paths = [
    'legacy/profile-images/old_file-1.png',
    'legacy/category-icons/old_file-1.png',
    'legacy/transaction-images/old_file-1.png',
  ]
  const values = ['profile-images', 'category-icons', 'transaction-images'].map(folder => legacy(folder))
  const { calls, operations } = await storageMock(new Set(paths))
  const urls = await operations.signStoredImageUrlsForUser('A', values.map(value => createStoredImageProvenance('A', value)))
  assert.deepEqual(calls.signed, [paths])
  for (const value of values) assert.match(urls.get(value) ?? '', /^https:\/\/signed\.invalid\//)
})

test('legacy isolado, estrangeiro ou divergente não cria cliente Storage', async () => {
  const { createStoredImageProvenance } = await storageModule
  const { calls, operations } = await storageMock()
  const value = legacy()
  await operations.signImageUrlsForUser('A', [value])
  await operations.signStoredImageUrlsForUser('A', [
    createStoredImageProvenance('B', value),
    { ownerId: 'A', value } as never,
  ])
  assert.deepEqual(calls, { created: 0, signed: [], removed: [] })
})

test('capability legacy é opaca e remoção envia somente objeto com provenance própria', async () => {
  const { createStoredImageProvenance, prepareStoredImageRemovalForUser } = await storageModule
  const value = legacy()
  const { calls, operations } = await storageMock()
  const own = prepareStoredImageRemovalForUser('B', createStoredImageProvenance('B', value))
  const foreign = prepareStoredImageRemovalForUser('B', createStoredImageProvenance('A', value))
  const forged = { ...(own ?? {}), objectPath: 'legacy/category-icons/forged.png' }
  await operations.removePreparedImages([foreign, forged as never, own])
  assert.deepEqual(calls.removed, [['legacy/category-icons/old_file-1.png']])
})

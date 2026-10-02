import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyStorageReference, isAuthorizedStorageReference, parseUnownedLegacyStorageReference } from '@/lib/storage-policy'

const config = { bucket: 'finance-uploads', supabaseUrl: 'https://project.supabase.co' }
const uuid = '123e4567-e89b-12d3-a456-426614174000'
const privateReference = (owner: string, folder = 'profile-images', file = `${uuid}.jpg`) =>
  `supabase-storage://finance-uploads/${owner}/${folder}/${file}`

test('classifica os três formatos aceitos', () => {
  const privateResult = classifyStorageReference(privateReference('A'), 'A', config)
  assert.equal(privateResult.kind, 'private-storage')
  assert.equal(isAuthorizedStorageReference(privateResult) && privateResult.objectPath, `A/profile-images/${uuid}.jpg`)

  const legacy = classifyStorageReference(
    `https://project.supabase.co/storage/v1/object/public/finance-uploads/A/category-icons/${uuid}.png`,
    'A',
    config,
  )
  assert.equal(legacy.kind, 'legacy-supabase-public')

  const local = classifyStorageReference(`/uploads/transaction-images/A-${uuid}.webp`, 'A', config)
  assert.deepEqual(local.kind, 'legacy-local-public')
})

test('parser legado sem owner aceita somente o namespace histórico estrito', () => {
  const base = `https://project.supabase.co/storage/v1/object/public/finance-uploads/legacy/category-icons/old_file-1.png`
  assert.equal(parseUnownedLegacyStorageReference(base, config)?.objectPath, 'legacy/category-icons/old_file-1.png')
  assert.equal(classifyStorageReference(base, 'A', config).kind, 'invalid')

  const invalid = [
    base.replace('project.supabase.co', 'other.supabase.co'),
    base.replace('finance-uploads', 'other'),
    base.replace('/legacy/category-icons/', '/legacy/../'),
    base.replace('/legacy/category-icons/', '/legacy/./'),
    base.replace('/legacy/category-icons/', '/legacy\\category-icons/'),
    base.replace('/legacy/', '/legacy/%2e%2e/'),
    base.replace('/legacy/', '/legacy/%252e%252e/'),
    `${base}?download=1`,
    `${base}#fragment`,
    base.replace('category-icons', 'unknown'),
    base.replace('.png', '.gif'),
    `${base}/extra`,
  ]
  for (const value of invalid) assert.equal(parseUnownedLegacyStorageReference(value, config), null, value)
})

test('ownership usa igualdade do segmento completo', () => {
  assert.equal(classifyStorageReference(privateReference('abc1234'), 'abc123', config).kind, 'invalid')
  assert.equal(classifyStorageReference(privateReference('abc123'), 'abc1234', config).kind, 'invalid')
  assert.equal(classifyStorageReference(privateReference('A'), 'B', config).kind, 'invalid')
})

test('rejeita traversal e sintaxe ambígua em qualquer formato', () => {
  const attacks = [
    'supabase-storage://finance-uploads/A/../B/file.jpg',
    'supabase-storage://finance-uploads/A/./profile-images/file.jpg',
    'supabase-storage://finance-uploads/A\\..\\B/file.jpg',
    'supabase-storage://finance-uploads/A/%2e%2e/B/file.jpg',
    'supabase-storage://finance-uploads/A/%252e%252e/B/file.jpg',
    'supabase-storage://finance-uploads/A/%2fB/file.jpg',
    'supabase-storage://finance-uploads/A/%5cB/file.jpg',
    'supabase-storage://finance-uploads/A//profile-images/file.jpg',
    `${privateReference('A')}?download=1`,
    `${privateReference('A')}#fragment`,
    `${privateReference('A')}\u0000`,
    `https://project.supabase.co/storage/v1/object/public/finance-uploads/A/../B/${uuid}.jpg`,
  ]
  for (const value of attacks) assert.equal(classifyStorageReference(value, 'A', config).kind, 'invalid', value)
})

test('rejeita origem, protocolo, bucket, pasta, extensão e formato desconhecidos', () => {
  const invalid = [
    `supabase-storage://other/A/profile-images/${uuid}.jpg`,
    `https://other.supabase.co/storage/v1/object/public/finance-uploads/A/profile-images/${uuid}.jpg`,
    `http://project.supabase.co/storage/v1/object/public/finance-uploads/A/profile-images/${uuid}.jpg`,
    `https://project.supabase.co/storage/v1/object/public/other/A/profile-images/${uuid}.jpg`,
    privateReference('A', 'unknown'),
    privateReference('A', 'profile-images', `${uuid}.gif`),
    'A/profile-images/file.jpg',
  ]
  for (const value of invalid) assert.equal(classifyStorageReference(value, 'A', config).kind, 'invalid', value)
})

test('URL legada exige ausência de query, fragmento e encoding', () => {
  const base = `https://project.supabase.co/storage/v1/object/public/finance-uploads/A/profile-images/${uuid}.jpg`
  for (const value of [`${base}?x=1`, `${base}#x`, base.replace('/A/', '/%41/')]) {
    assert.equal(classifyStorageReference(value, 'A', config).kind, 'invalid')
  }
})

test('URL legada valida origem, credenciais, forma absoluta e quantidade de segmentos', () => {
  const path = `/storage/v1/object/public/finance-uploads/A/profile-images/${uuid}.jpg`
  const invalid = [
    `https://project.supabase.co:444${path}`,
    `https://user@project.supabase.co${path}`,
    `https://user:password@project.supabase.co${path}`,
    `https://project.supabase.co.evil.example${path}`,
    path,
    `https://project.supabase.co/storage/v1/object/public/finance-uploads/A/profile-images`,
    `https://project.supabase.co${path}/extra`,
  ]
  for (const value of invalid) assert.equal(classifyStorageReference(value, 'A', config).kind, 'invalid', value)

  assert.equal(
    classifyStorageReference(`https://PROJECT.SUPABASE.CO${path}`, 'A', config).kind,
    'legacy-supabase-public',
  )
})

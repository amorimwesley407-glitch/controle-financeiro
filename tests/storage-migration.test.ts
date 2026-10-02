import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMigrationEntries,
  createDestination,
  metadataEquivalent,
  requireExactlyOneRow,
  validatePrivateDestination,
  validateRecordProvenance,
  validateRollback,
  type MigrationRecord,
  type ObjectMetadata,
} from '@/lib/storage-migration'

const config = { bucket: 'finance-uploads', supabaseUrl: 'https://grjsehbkitlvzxhsacwa.supabase.co' }
const legacy = (folder = 'category-icons', file = 'old_file-1.png') =>
  `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/legacy/${folder}/${file}`
const record = (overrides: Partial<MigrationRecord> = {}): MigrationRecord => ({
  recordType: 'category', recordId: '10', ownerId: 'owner-A', field: 'imagePath', legacyReference: legacy(), ...overrides,
})
const metadata: ObjectMetadata = { size: 1234, mimeType: 'image/png', etag: 'etag-1' }

test('destino privado é determinístico, usa owner e formato esperado', () => {
  const first = createDestination(record(), 'legacy/category-icons/old_file-1.png', config.bucket)
  const second = createDestination(record(), 'legacy/category-icons/old_file-1.png', config.bucket)
  assert.deepEqual(first, second)
  assert.match(first?.destinationObjectPath ?? '', /^owner-A\/category-icons\/[0-9a-f-]{36}\.png$/)
  assert.equal(first?.destinationReference.startsWith('supabase-storage://finance-uploads/owner-A/'), true)
})

test('planejamento repetido preserva o destino e valida origem', () => {
  const source = 'legacy/category-icons/old_file-1.png'
  const destination = createDestination(record(), source, config.bucket)!
  const objects = new Map<string, ObjectMetadata | null>([[source, metadata], [destination.destinationObjectPath, null]])
  const first = buildMigrationEntries([record()], config, objects)
  const second = buildMigrationEntries([record()], config, objects)
  assert.equal(first[0].destinationObjectPath, second[0].destinationObjectPath)
  assert.equal(first[0].validationStatus, 'VALIDATED')
  assert.equal(first[0].migrationStatus, 'PENDING')
  assert.equal(validatePrivateDestination(first[0]), true)
})

test('ownership exige registro existente, owner e referência exatos', () => {
  assert.equal(validateRecordProvenance(record(), record()), true)
  assert.equal(validateRecordProvenance(record(), null), false)
  assert.equal(validateRecordProvenance(record(), record({ ownerId: 'owner-B' })), false)
  assert.equal(validateRecordProvenance(record(), record({ legacyReference: legacy('category-icons', 'changed.png') })), false)
})

test('referência compartilhada bloqueia owners diferentes e o mesmo owner', () => {
  const crossOwner = buildMigrationEntries([record(), record({ recordId: '11', ownerId: 'owner-B' })], config, new Map())
  assert.ok(crossOwner.every(entry => entry.validationStatus === 'SHARED_REFERENCE' && entry.reason === 'SHARED_CROSS_OWNER'))
  const sameOwner = buildMigrationEntries([record(), record({ recordId: '11' })], config, new Map())
  assert.ok(sameOwner.every(entry => entry.validationStatus === 'SHARED_REFERENCE' && entry.reason === 'SHARED_SAME_OWNER'))
})

test('parser de planejamento rejeita origem maliciosa ou incompatível', () => {
  const invalid = [
    legacy().replace('grjsehbkitlvzxhsacwa.supabase.co', 'evil.example'),
    legacy().replace('finance-uploads', 'other'),
    legacy('unknown'),
    legacy().replace('/legacy/category-icons/', '/legacy/../'),
    legacy().replace('/legacy/category-icons/', '/legacy/%2e%2e/'),
    legacy().replace('/legacy/category-icons/', '/legacy/%2f/'),
    legacy().replace('/legacy/category-icons/', '/legacy/%5c/'),
    legacy().replace('/legacy/category-icons/', '/legacy/%25/'),
    `${legacy()}?download=1`,
    `${legacy()}#fragment`,
    legacy().replace('/legacy/category-icons/', '/legacy\\category-icons/'),
    `${legacy()}/extra`,
  ]
  for (const value of invalid) {
    const [entry] = buildMigrationEntries([record({ legacyReference: value })], config, new Map())
    assert.equal(entry.validationStatus, 'BLOCKED', value)
  }
})

test('origem ausente e conflito de destino bloqueiam o plano', () => {
  const missing = buildMigrationEntries([record()], config, new Map())[0]
  assert.equal(missing.validationStatus, 'SOURCE_MISSING')
  const source = 'legacy/category-icons/old_file-1.png'
  const destination = createDestination(record(), source, config.bucket)!
  const conflict = buildMigrationEntries([record()], config, new Map([
    [source, metadata],
    [destination.destinationObjectPath, { ...metadata, size: 999 }],
  ]))[0]
  assert.equal(conflict.validationStatus, 'DESTINATION_CONFLICT')
  assert.equal(metadataEquivalent(metadata, { ...metadata }), true)
})

test('destino estrangeiro, UUID e extensão adulterados são rejeitados', () => {
  const source = 'legacy/category-icons/old_file-1.png'
  const entry = buildMigrationEntries([record()], config, new Map([[source, metadata]]))[0]
  assert.equal(validatePrivateDestination({ ...entry, destinationObjectPath: entry.destinationObjectPath?.replace('owner-A/', 'owner-B/') ?? null }), false)
  assert.equal(validatePrivateDestination({ ...entry, destinationObjectPath: 'owner-A/category-icons/not-a-uuid.png' }), false)
  assert.equal(validatePrivateDestination({ ...entry, destinationObjectPath: entry.destinationObjectPath?.replace('.png', '.gif') ?? null }), false)
})

test('update exige exatamente uma linha', () => {
  assert.doesNotThrow(() => requireExactlyOneRow(1))
  assert.throws(() => requireExactlyOneRow(0), /exatamente 1/)
  assert.throws(() => requireExactlyOneRow(2), /exatamente 1/)
})

test('rollback exige origem e referência atual esperada', () => {
  const source = 'legacy/category-icons/old_file-1.png'
  const entry = buildMigrationEntries([record()], config, new Map([[source, metadata]]))[0]
  assert.equal(validateRollback(entry, true, entry.destinationReference).allowed, true)
  assert.deepEqual(validateRollback(entry, false, entry.destinationReference), { allowed: false, reason: 'SOURCE_MISSING' })
  assert.deepEqual(validateRollback(entry, true, 'different'), { allowed: false, reason: 'DB_REFERENCE_DIVERGED' })
})

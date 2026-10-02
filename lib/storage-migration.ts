import { createHash } from 'node:crypto'
import {
  parseUnownedLegacyStorageReference,
  type StorageFolder,
  type StoragePolicyConfig,
} from '@/lib/storage-policy'

export const MIGRATION_MANIFEST_VERSION = 1 as const

export type MigrationRecordType = 'profile' | 'category' | 'transaction'
export type MigrationState =
  | 'PENDING'
  | 'BLOCKED'
  | 'SOURCE_MISSING'
  | 'SHARED_REFERENCE'
  | 'DESTINATION_CONFLICT'
  | 'COPIED'
  | 'VALIDATED'
  | 'DB_UPDATED'
  | 'VERIFIED'
  | 'ROLLBACK_READY'

export type MigrationRecord = {
  recordType: MigrationRecordType
  recordId: string
  ownerId: string
  field: 'image' | 'imagePath'
  legacyReference: string
}

export type ObjectMetadata = {
  size: number | null
  mimeType: string | null
  etag: string | null
}

export type MigrationManifestEntry = MigrationRecord & {
  sourceObjectPath: string | null
  destinationObjectPath: string | null
  destinationReference: string | null
  sourceExists: boolean
  sourceMetadata: ObjectMetadata | null
  destinationExists: boolean
  destinationMetadata: ObjectMetadata | null
  sharedReference: boolean
  owners: string[]
  records: Array<{ recordType: MigrationRecordType; recordId: string; ownerId: string }>
  validationStatus: MigrationState
  migrationStatus: MigrationState
  reason: string | null
}

export type MigrationManifest = {
  version: typeof MIGRATION_MANIFEST_VERSION
  mode: 'dry-run' | 'apply' | 'rollback'
  generatedAt: string
  projectOrigin: string
  bucket: string
  entries: MigrationManifestEntry[]
}

const expectedFolders: Record<MigrationRecordType, StorageFolder> = {
  profile: 'profile-images',
  category: 'category-icons',
  transaction: 'transaction-images',
}

function deterministicUuid(seed: string) {
  const bytes = Buffer.from(createHash('sha256').update(seed).digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const value = bytes.toString('hex')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

export function createDestination(record: MigrationRecord, sourceObjectPath: string, bucket: string) {
  const sourceFileName = sourceObjectPath.split('/').at(-1) ?? ''
  const extension = sourceFileName.split('.').at(-1)?.toLowerCase()
  if (!extension || !['png', 'jpg', 'webp', 'avif'].includes(extension)) return null
  const folder = expectedFolders[record.recordType]
  const uuid = deterministicUuid([
    MIGRATION_MANIFEST_VERSION,
    record.recordType,
    record.recordId,
    record.ownerId,
    record.legacyReference,
  ].join('\0'))
  const destinationObjectPath = `${record.ownerId}/${folder}/${uuid}.${extension}`
  return {
    destinationObjectPath,
    destinationReference: `supabase-storage://${bucket}/${destinationObjectPath}`,
  }
}

export function metadataEquivalent(source: ObjectMetadata | null, destination: ObjectMetadata | null) {
  if (!source || !destination) return false
  if (source.size !== destination.size || source.mimeType !== destination.mimeType) return false
  return !source.etag || !destination.etag || source.etag === destination.etag
}

export function buildMigrationEntries(
  records: MigrationRecord[],
  config: StoragePolicyConfig,
  metadataByPath: ReadonlyMap<string, ObjectMetadata | null>,
): MigrationManifestEntry[] {
  const occurrences = new Map<string, MigrationRecord[]>()
  for (const record of records) {
    const current = occurrences.get(record.legacyReference) ?? []
    current.push(record)
    occurrences.set(record.legacyReference, current)
  }

  return records.map(record => {
    const parsed = parseUnownedLegacyStorageReference(record.legacyReference, config)
    const matching = occurrences.get(record.legacyReference) ?? []
    const owners = [...new Set(matching.map(item => item.ownerId))].sort()
    const sharedReference = matching.length > 1
    const base = {
      ...record,
      sourceObjectPath: parsed?.objectPath ?? null,
      destinationObjectPath: null,
      destinationReference: null,
      sourceExists: false,
      sourceMetadata: null,
      destinationExists: false,
      destinationMetadata: null,
      sharedReference,
      owners,
      records: matching.map(item => ({ recordType: item.recordType, recordId: item.recordId, ownerId: item.ownerId })),
    }
    if (!parsed || parsed.folder !== expectedFolders[record.recordType]) {
      return { ...base, validationStatus: 'BLOCKED', migrationStatus: 'BLOCKED', reason: 'INVALID_LEGACY_REFERENCE' }
    }
    if (sharedReference) {
      return { ...base, validationStatus: 'SHARED_REFERENCE', migrationStatus: 'SHARED_REFERENCE', reason: owners.length > 1 ? 'SHARED_CROSS_OWNER' : 'SHARED_SAME_OWNER' }
    }
    const destination = createDestination(record, parsed.objectPath, config.bucket)
    if (!destination) return { ...base, validationStatus: 'BLOCKED', migrationStatus: 'BLOCKED', reason: 'INVALID_DESTINATION' }
    const sourceMetadata = metadataByPath.get(parsed.objectPath) ?? null
    const destinationMetadata = metadataByPath.get(destination.destinationObjectPath) ?? null
    if (!sourceMetadata) {
      return { ...base, ...destination, sourceMetadata, destinationMetadata, validationStatus: 'SOURCE_MISSING', migrationStatus: 'SOURCE_MISSING', reason: 'SOURCE_MISSING' }
    }
    if (destinationMetadata && !metadataEquivalent(sourceMetadata, destinationMetadata)) {
      return {
        ...base, ...destination, sourceExists: true, sourceMetadata, destinationExists: true, destinationMetadata,
        validationStatus: 'DESTINATION_CONFLICT', migrationStatus: 'DESTINATION_CONFLICT', reason: 'DESTINATION_CONTENT_MISMATCH',
      }
    }
    return {
      ...base, ...destination, sourceExists: true, sourceMetadata,
      destinationExists: Boolean(destinationMetadata), destinationMetadata,
      validationStatus: 'VALIDATED', migrationStatus: 'PENDING', reason: null,
    }
  })
}

export function requireExactlyOneRow(affectedRows: number) {
  if (affectedRows !== 1) throw new Error(`Esperava atualizar exatamente 1 registro; resultado: ${affectedRows}`)
}

export function validateRecordProvenance(record: MigrationRecord, current: MigrationRecord | null) {
  return Boolean(
    current
    && current.recordType === record.recordType
    && current.recordId === record.recordId
    && current.ownerId === record.ownerId
    && current.field === record.field
    && current.legacyReference === record.legacyReference,
  )
}

export function validatePrivateDestination(entry: MigrationManifestEntry) {
  if (!entry.destinationObjectPath || !entry.destinationReference) return false
  const expectedBucket = entry.destinationReference.split('/')[2] ?? ''
  const expected = createDestination(entry, entry.sourceObjectPath ?? '', expectedBucket)
  return Boolean(
    expected
    && entry.destinationObjectPath === expected.destinationObjectPath
    && entry.destinationReference === expected.destinationReference
    && !entry.destinationObjectPath.startsWith('legacy/'),
  )
}

export function validateRollback(entry: MigrationManifestEntry, sourceExists: boolean, currentReference: string | null) {
  if (!sourceExists) return { allowed: false, reason: 'SOURCE_MISSING' } as const
  if (!entry.destinationReference || currentReference !== entry.destinationReference) {
    return { allowed: false, reason: 'DB_REFERENCE_DIVERGED' } as const
  }
  return { allowed: true, reason: null } as const
}

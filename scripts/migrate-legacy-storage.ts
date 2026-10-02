import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import {
  MIGRATION_MANIFEST_VERSION,
  buildMigrationEntries,
  metadataEquivalent,
  requireExactlyOneRow,
  validatePrivateDestination,
  validateRollback,
  type MigrationManifest,
  type MigrationManifestEntry,
  type MigrationRecord,
  type ObjectMetadata,
} from '../lib/storage-migration'
import { parseUnownedLegacyStorageReference } from '../lib/storage-policy'

loadEnvConfig(process.cwd())

const defaultManifestPath = resolve('.artifacts/storage-migration/legacy-images-manifest.json')
const forbiddenArguments = ['--database-url', '--service-role-key', '--supabase-url']

function parseArguments(args: string[]) {
  if (args.some(arg => forbiddenArguments.some(name => arg === name || arg.startsWith(`${name}=`)))) {
    throw new Error('Credenciais devem vir exclusivamente do ambiente, nunca de argumentos')
  }
  const modes = ['--dry-run', '--apply', '--rollback'].filter(mode => args.includes(mode))
  if (modes.length !== 1) throw new Error('Escolha exatamente um modo: --dry-run, --apply ou --rollback')
  const manifestIndex = args.indexOf('--manifest')
  const manifestPath = manifestIndex >= 0 ? args[manifestIndex + 1] : defaultManifestPath
  if (!manifestPath || manifestPath.startsWith('--')) throw new Error('Informe um caminho válido após --manifest')
  return { mode: modes[0].slice(2) as 'dry-run' | 'apply' | 'rollback', manifestPath: resolve(manifestPath) }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}`)
  return value
}

function toMetadata(value: { size?: number; contentType?: string; etag?: string } | null): ObjectMetadata | null {
  if (!value) return null
  return { size: value.size ?? null, mimeType: value.contentType ?? null, etag: value.etag ?? null }
}

async function writeManifest(path: string, manifest: MigrationManifest) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, path)
}

async function loadRecords(sql: postgres.Sql): Promise<MigrationRecord[]> {
  const [profiles, categoryRows, transactionRows] = await Promise.all([
    sql<Array<{ id: string; image: string }>>`select id, image from public."user" where image is not null`,
    sql<Array<{ id: number; ownerId: string; imagePath: string }>>`select id, "userId" as "ownerId", "imagePath" from public.categories where "imagePath" is not null`,
    sql<Array<{ id: number; ownerId: string; imagePath: string }>>`select id, "userId" as "ownerId", "imagePath" from public.transactions where "imagePath" is not null`,
  ])
  return [
    ...profiles.map(row => ({ recordType: 'profile' as const, recordId: row.id, ownerId: row.id, field: 'image' as const, legacyReference: row.image })),
    ...categoryRows.map(row => ({ recordType: 'category' as const, recordId: String(row.id), ownerId: row.ownerId, field: 'imagePath' as const, legacyReference: row.imagePath })),
    ...transactionRows.map(row => ({ recordType: 'transaction' as const, recordId: String(row.id), ownerId: row.ownerId, field: 'imagePath' as const, legacyReference: row.imagePath })),
  ]
}

async function readCurrentReference(sql: postgres.Sql, entry: MigrationManifestEntry) {
  if (entry.recordType === 'profile') {
    const rows = await sql<Array<{ value: string | null }>>`select image as value from public."user" where id = ${entry.ownerId}`
    return rows[0]?.value ?? null
  }
  if (entry.recordType === 'category') {
    const rows = await sql<Array<{ value: string | null }>>`select "imagePath" as value from public.categories where id = ${Number(entry.recordId)} and "userId" = ${entry.ownerId}`
    return rows[0]?.value ?? null
  }
  const rows = await sql<Array<{ value: string | null }>>`select "imagePath" as value from public.transactions where id = ${Number(entry.recordId)} and "userId" = ${entry.ownerId}`
  return rows[0]?.value ?? null
}

async function updateReference(sql: postgres.Sql, entry: MigrationManifestEntry, from: string, to: string) {
  let result
  if (entry.recordType === 'profile') {
    result = await sql`update public."user" set image = ${to} where id = ${entry.ownerId} and image = ${from}`
  } else if (entry.recordType === 'category') {
    result = await sql`update public.categories set "imagePath" = ${to} where id = ${Number(entry.recordId)} and "userId" = ${entry.ownerId} and "imagePath" = ${from}`
  } else {
    result = await sql`update public.transactions set "imagePath" = ${to} where id = ${Number(entry.recordId)} and "userId" = ${entry.ownerId} and "imagePath" = ${from}`
  }
  requireExactlyOneRow(result.count)
}

async function confirmDatabaseProvenance(sql: postgres.Sql, entry: MigrationManifestEntry) {
  return await readCurrentReference(sql, entry) === entry.legacyReference
}

async function confirmRecordProvenance(sql: postgres.Sql, record: MigrationRecord) {
  if (record.recordType === 'profile') {
    const rows = await sql`select id from public."user" where id = ${record.ownerId} and image = ${record.legacyReference}`
    return rows.length === 1
  }
  if (record.recordType === 'category') {
    const rows = await sql`select id from public.categories where id = ${Number(record.recordId)} and "userId" = ${record.ownerId} and "imagePath" = ${record.legacyReference}`
    return rows.length === 1
  }
  const rows = await sql`select id from public.transactions where id = ${Number(record.recordId)} and "userId" = ${record.ownerId} and "imagePath" = ${record.legacyReference}`
  return rows.length === 1
}

async function getObjectMetadata(storage: ReturnType<ReturnType<typeof createClient>['storage']['from']>, path: string) {
  const { data, error } = await storage.info(path)
  if (error) {
    if (error.status === 404 || error.statusCode === '404' || error.statusCode === 'not_found') return null
    throw new Error(`Falha ao consultar metadados do Storage (${error.statusCode ?? error.status ?? 'unknown'})`)
  }
  return toMetadata(data)
}

async function createPlan(
  sql: postgres.Sql,
  storage: ReturnType<ReturnType<typeof createClient>['storage']['from']>,
  bucket: string,
  supabaseUrl: string,
) {
  const records = await loadRecords(sql)
  const provenanceResults = await Promise.all(records.map(record => confirmRecordProvenance(sql, record)))
  const structurallyValid = records.flatMap((record, index) => {
    if (!provenanceResults[index]) return []
    const parsed = parseUnownedLegacyStorageReference(record.legacyReference, { bucket, supabaseUrl })
    return parsed ? [parsed.objectPath] : []
  })
  const provisional = buildMigrationEntries(records, { bucket, supabaseUrl }, new Map())
  const destinationPaths = provisional.flatMap(entry => entry.destinationObjectPath ? [entry.destinationObjectPath] : [])
  const metadataByPath = new Map<string, ObjectMetadata | null>()
  await Promise.all([...new Set([...structurallyValid, ...destinationPaths])].map(async path => {
    metadataByPath.set(path, await getObjectMetadata(storage, path))
  }))
  const entries = buildMigrationEntries(records, { bucket, supabaseUrl }, metadataByPath)
  entries.forEach((entry, index) => {
    if (!provenanceResults[index]) {
      entry.validationStatus = 'BLOCKED'; entry.migrationStatus = 'BLOCKED'; entry.reason = 'DATABASE_PROVENANCE_CHANGED'
    }
  })
  return entries
}

function assertApplyReady(entries: MigrationManifestEntry[]) {
  const blocked = entries.filter(entry => entry.validationStatus !== 'VALIDATED')
  if (blocked.length) throw new Error(`Migração bloqueada: ${blocked.length} registro(s) falharam no preflight`)
}

async function applyEntry(
  sql: postgres.Sql,
  storage: ReturnType<ReturnType<typeof createClient>['storage']['from']>,
  entry: MigrationManifestEntry,
) {
  if (!entry.sourceObjectPath || !entry.destinationObjectPath || !entry.destinationReference || !validatePrivateDestination(entry)) {
    throw new Error(`Destino inválido para ${entry.recordType}:${entry.recordId}`)
  }
  if (!await confirmDatabaseProvenance(sql, entry)) throw new Error(`Proveniência mudou para ${entry.recordType}:${entry.recordId}`)
  let destinationMetadata = await getObjectMetadata(storage, entry.destinationObjectPath)
  if (destinationMetadata) {
    if (!metadataEquivalent(entry.sourceMetadata, destinationMetadata)) throw new Error(`Conflito no destino ${entry.destinationObjectPath}`)
  } else {
    const { error } = await storage.copy(entry.sourceObjectPath, entry.destinationObjectPath)
    if (error) throw new Error(`Falha ao copiar ${entry.recordType}:${entry.recordId}: ${error.message}`)
    entry.migrationStatus = 'COPIED'
    destinationMetadata = await getObjectMetadata(storage, entry.destinationObjectPath)
  }
  if (!metadataEquivalent(entry.sourceMetadata, destinationMetadata)) throw new Error(`Destino não validado para ${entry.recordType}:${entry.recordId}`)
  entry.destinationExists = true
  entry.destinationMetadata = destinationMetadata
  entry.migrationStatus = 'VALIDATED'
  await updateReference(sql, entry, entry.legacyReference, entry.destinationReference)
  entry.migrationStatus = 'DB_UPDATED'
  const current = await readCurrentReference(sql, entry)
  if (current !== entry.destinationReference || !await getObjectMetadata(storage, entry.destinationObjectPath)) {
    throw new Error(`Verificação pós-update falhou para ${entry.recordType}:${entry.recordId}`)
  }
  const { createStoredImageProvenance, signStoredImageUrlsForUser } = await import('../lib/storage')
  const signed = await signStoredImageUrlsForUser(entry.ownerId, [createStoredImageProvenance(entry.ownerId, entry.destinationReference)])
  if (!signed.has(entry.destinationReference)) throw new Error(`Fluxo de assinatura falhou para ${entry.recordType}:${entry.recordId}`)
  entry.migrationStatus = 'VERIFIED'
  entry.validationStatus = 'ROLLBACK_READY'
}

async function rollbackEntry(
  sql: postgres.Sql,
  storage: ReturnType<ReturnType<typeof createClient>['storage']['from']>,
  entry: MigrationManifestEntry,
) {
  if (!entry.sourceObjectPath || !entry.destinationReference) throw new Error(`Manifest incompleto para ${entry.recordType}:${entry.recordId}`)
  const sourceExists = Boolean(await getObjectMetadata(storage, entry.sourceObjectPath))
  const current = await readCurrentReference(sql, entry)
  const validation = validateRollback(entry, sourceExists, current)
  if (!validation.allowed) throw new Error(`Rollback bloqueado para ${entry.recordType}:${entry.recordId}: ${validation.reason}`)
  await updateReference(sql, entry, entry.destinationReference, entry.legacyReference)
  if (await readCurrentReference(sql, entry) !== entry.legacyReference) throw new Error(`Rollback não confirmado para ${entry.recordType}:${entry.recordId}`)
  entry.migrationStatus = 'ROLLBACK_READY'
}

function printSummary(entries: MigrationManifestEntry[], mode: string, manifestPath: string) {
  const count = (type: MigrationRecord['recordType']) => entries.filter(entry => entry.recordType === type).length
  console.log(JSON.stringify({
    mode,
    manifest: manifestPath,
    inventory: { profile: count('profile'), categories: count('category'), transactions: count('transaction'), total: entries.length },
    ownership: {
      valid: entries.filter(entry => entry.validationStatus === 'VALIDATED' || entry.validationStatus === 'ROLLBACK_READY').length,
      shared: entries.filter(entry => entry.sharedReference).length,
      invalid: entries.filter(entry => entry.validationStatus === 'BLOCKED').length,
    },
    storage: {
      sourceExists: entries.filter(entry => entry.sourceExists).length,
      sourceMissing: entries.filter(entry => entry.validationStatus === 'SOURCE_MISSING').length,
      destinationConflicts: entries.filter(entry => entry.validationStatus === 'DESTINATION_CONFLICT').length,
    },
    operations: { copies: mode === 'apply' ? entries.filter(entry => entry.migrationStatus === 'COPIED').length : 0, databaseUpdates: mode === 'apply' ? entries.filter(entry => ['DB_UPDATED', 'VERIFIED'].includes(entry.migrationStatus)).length : 0, deletions: 0 },
  }, null, 2))
}

async function main() {
  const { mode, manifestPath } = parseArguments(process.argv.slice(2))
  const databaseUrl = requiredEnvironment('DATABASE_URL')
  const supabaseUrl = requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'finance-uploads'
  const sql = postgres(databaseUrl, { prepare: false, max: 1 })
  const storage = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket)
  try {
    if (mode === 'rollback') {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as MigrationManifest
      if (manifest.version !== MIGRATION_MANIFEST_VERSION || manifest.bucket !== bucket || manifest.projectOrigin !== new URL(supabaseUrl).origin) throw new Error('Manifest incompatível com o ambiente')
      for (const entry of manifest.entries) await rollbackEntry(sql, storage, entry)
      manifest.mode = 'rollback'; manifest.generatedAt = new Date().toISOString()
      await writeManifest(manifestPath, manifest)
      printSummary(manifest.entries, mode, manifestPath)
      return
    }
    const entries = await createPlan(sql, storage, bucket, supabaseUrl)
    const manifest: MigrationManifest = { version: MIGRATION_MANIFEST_VERSION, mode, generatedAt: new Date().toISOString(), projectOrigin: new URL(supabaseUrl).origin, bucket, entries }
    await writeManifest(manifestPath, manifest)
    if (mode === 'apply') {
      assertApplyReady(entries)
      for (const entry of entries) { await applyEntry(sql, storage, entry); await writeManifest(manifestPath, manifest) }
    }
    printSummary(entries, mode, manifestPath)
  } finally {
    await sql.end()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na migração')
  process.exitCode = 1
})

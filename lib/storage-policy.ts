export const STORAGE_FOLDERS = ['profile-images', 'category-icons', 'transaction-images'] as const

export type StorageFolder = typeof STORAGE_FOLDERS[number]

export type AuthorizedStorageReference = {
  kind: 'private-storage' | 'legacy-supabase-public'
  value: string
  objectPath: string
  ownerId: string
  folder: StorageFolder
  fileName: string
}

export type LegacyLocalReference = {
  kind: 'legacy-local-public'
  value: string
  publicPath: string
  folder: StorageFolder
  fileName: string
}

export type InvalidStorageReference = {
  kind: 'invalid'
  value: string | null | undefined
}

export type ClassifiedStorageReference =
  | AuthorizedStorageReference
  | LegacyLocalReference
  | InvalidStorageReference

export type StoragePolicyConfig = {
  bucket: string
  supabaseUrl?: string | null
}

const folderSet = new Set<string>(STORAGE_FOLDERS)
const generatedFileName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp|avif)$/
const legacyLocalFileName = /^[A-Za-z0-9_-]+\.(?:png|jpg|webp|avif)$/
const controlCharacter = /[\u0000-\u001f\u007f]/

function invalid(value: string | null | undefined): InvalidStorageReference {
  return { kind: 'invalid', value }
}

function hasAmbiguousSyntax(value: string) {
  return controlCharacter.test(value) || value.includes('\\') || value.includes('%')
}

function hasDotPathSegment(value: string) {
  return value.split('/').some(segment => segment === '.' || segment === '..')
}

function authorizeObjectPath(
  value: string,
  objectPath: string,
  authenticatedUserId: string,
  kind: AuthorizedStorageReference['kind'],
): AuthorizedStorageReference | InvalidStorageReference {
  if (!authenticatedUserId || hasAmbiguousSyntax(objectPath) || objectPath.includes('//')) return invalid(value)
  const segments = objectPath.split('/')
  if (segments.length !== 3) return invalid(value)
  const [ownerId, folder, fileName] = segments
  if (!ownerId || ownerId === '.' || ownerId === '..' || ownerId !== authenticatedUserId) return invalid(value)
  if (!folderSet.has(folder) || !generatedFileName.test(fileName)) return invalid(value)
  return { kind, value, objectPath, ownerId, folder: folder as StorageFolder, fileName }
}

function classifyPrivateReference(
  value: string,
  authenticatedUserId: string,
  bucket: string,
): ClassifiedStorageReference | null {
  const prefix = `supabase-storage://${bucket}/`
  if (!value.startsWith('supabase-storage://')) return null
  if (!bucket || hasAmbiguousSyntax(value) || value.includes('?') || value.includes('#') || !value.startsWith(prefix)) return invalid(value)
  return authorizeObjectPath(value, value.slice(prefix.length), authenticatedUserId, 'private-storage')
}

function classifyLegacySupabaseReference(
  value: string,
  authenticatedUserId: string,
  config: StoragePolicyConfig,
): ClassifiedStorageReference | null {
  if (!/^https?:\/\//i.test(value)) return null
  if (!config.bucket || !config.supabaseUrl || hasAmbiguousSyntax(value) || hasDotPathSegment(value)) return invalid(value)
  let referenceUrl: URL
  let configuredUrl: URL
  try {
    referenceUrl = new URL(value)
    configuredUrl = new URL(config.supabaseUrl)
  } catch {
    return invalid(value)
  }
  if (
    referenceUrl.protocol !== 'https:' ||
    configuredUrl.protocol !== 'https:' ||
    referenceUrl.origin !== configuredUrl.origin ||
    referenceUrl.username ||
    referenceUrl.password ||
    referenceUrl.search ||
    referenceUrl.hash
  ) return invalid(value)

  const prefix = `/storage/v1/object/public/${config.bucket}/`
  if (!referenceUrl.pathname.startsWith(prefix)) return invalid(value)
  const objectPath = referenceUrl.pathname.slice(prefix.length)
  return authorizeObjectPath(value, objectPath, authenticatedUserId, 'legacy-supabase-public')
}

function classifyLegacyLocalReference(value: string): ClassifiedStorageReference | null {
  if (!value.startsWith('/uploads/')) return null
  if (hasAmbiguousSyntax(value) || value.includes('?') || value.includes('#') || value.includes('//')) return invalid(value)
  const segments = value.split('/')
  if (segments.length !== 4 || segments[0] !== '' || segments[1] !== 'uploads') return invalid(value)
  const [, , folder, fileName] = segments
  if (!folderSet.has(folder) || !legacyLocalFileName.test(fileName)) return invalid(value)
  return { kind: 'legacy-local-public', value, publicPath: value, folder: folder as StorageFolder, fileName }
}

export function classifyStorageReference(
  value: string | null | undefined,
  authenticatedUserId: string,
  config: StoragePolicyConfig,
): ClassifiedStorageReference {
  if (!value || controlCharacter.test(value)) return invalid(value)
  return classifyPrivateReference(value, authenticatedUserId, config.bucket)
    ?? classifyLegacySupabaseReference(value, authenticatedUserId, config)
    ?? classifyLegacyLocalReference(value)
    ?? invalid(value)
}

export function isAuthorizedStorageReference(
  reference: ClassifiedStorageReference,
): reference is AuthorizedStorageReference {
  return reference.kind === 'private-storage' || reference.kind === 'legacy-supabase-public'
}

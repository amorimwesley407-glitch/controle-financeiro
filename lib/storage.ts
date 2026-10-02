import { createClient } from '@supabase/supabase-js'
import {
  classifyStorageReference,
  isAuthorizedStorageReference,
  parseUnownedLegacyStorageReference,
  type AuthorizedStorageReference,
  type StorageFolder,
} from '@/lib/storage-policy'

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'finance-uploads'
const storagePrefix = `supabase-storage://${bucket}/`

type StorageError = { message: string } | null
type StorageBucketClient = {
  createSignedUrls: (paths: string[], expiresIn: number) => Promise<{ data: Array<{ signedUrl?: string | null }> | null; error: StorageError }>
  remove: (paths: string[]) => Promise<{ error: StorageError }>
}
type StorageClient = { from: (bucketName: string) => StorageBucketClient }
declare const preparedRemovalBrand: unique symbol
export type PreparedImageRemoval = AuthorizedStorageReference & { readonly [preparedRemovalBrand]: true }
const preparedRemovals = new WeakSet<object>()
declare const storedImageProvenanceBrand: unique symbol

export type StoredImageProvenance = Readonly<{
  ownerId: string
  value: string | null | undefined
  readonly [storedImageProvenanceBrand]: true
}>
const storedImageProvenances = new WeakSet<object>()

export function createStoredImageProvenance(ownerId: string, storedValue: string | null | undefined): StoredImageProvenance {
  const provenance = { ownerId, value: storedValue }
  storedImageProvenances.add(provenance)
  return provenance as StoredImageProvenance
}

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage
}

const policyConfig = () => ({ bucket, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })

export async function uploadImage(file: File, userId: string, folder: StorageFolder) {
  if (!file.size) return null
  if (file.size > 2 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 2 MB')
  const formats: Record<string, { ext: string; magic: number[]; offset?: number }> = {
    'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] }, 'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
    'image/webp': { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] }, 'image/avif': { ext: 'avif', magic: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  }
  const format = formats[file.type]
  if (!format) throw new Error('Use uma imagem PNG, JPG, WebP ou AVIF')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!format.magic.every((value, index) => bytes[index + (format.offset ?? 0)] === value)) throw new Error('Arquivo de imagem inválido')
  const objectPath = `${userId}/${folder}/${crypto.randomUUID()}.${format.ext}`
  const client = storage()
  const { error } = await client.from(bucket).upload(objectPath, bytes, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Falha no upload: ${error.message}`)
  return `${storagePrefix}${objectPath}`
}

export function prepareImageRemovalForUser(userId: string, value: string | null | undefined): PreparedImageRemoval | null {
  const reference = classifyStorageReference(value, userId, policyConfig())
  if (!isAuthorizedStorageReference(reference)) return null
  preparedRemovals.add(reference)
  return reference as PreparedImageRemoval
}

function authorizeStoredImageForUser(userId: string, provenance: StoredImageProvenance): AuthorizedStorageReference | null {
  if (!userId || !storedImageProvenances.has(provenance) || provenance.ownerId !== userId) return null
  const regular = classifyStorageReference(provenance.value, userId, policyConfig())
  if (isAuthorizedStorageReference(regular)) return regular
  const legacy = parseUnownedLegacyStorageReference(provenance.value, policyConfig())
  if (!legacy) return null
  return { ...legacy, ownerId: userId }
}

export function prepareStoredImageRemovalForUser(userId: string, provenance: StoredImageProvenance): PreparedImageRemoval | null {
  const reference = authorizeStoredImageForUser(userId, provenance)
  if (!reference) return null
  preparedRemovals.add(reference)
  return reference as PreparedImageRemoval
}

export function createStorageAuthorizationOperations(getStorage: () => StorageClient = storage) {
  const operations = {
    async signImageUrlsForUser(userId: string, values: Array<string | null | undefined>) {
      const result = new Map<string, string>()
      const authorizedByPath = new Map<string, AuthorizedStorageReference>()
      for (const value of values) {
        const reference = classifyStorageReference(value, userId, policyConfig())
        if (reference.kind === 'legacy-local-public') result.set(reference.value, reference.publicPath)
        else if (isAuthorizedStorageReference(reference)) authorizedByPath.set(reference.objectPath, reference)
      }
      const authorized = [...authorizedByPath.values()]
      if (!authorized.length) return result
      const { data, error } = await getStorage().from(bucket).createSignedUrls(authorized.map(item => item.objectPath), 60 * 60)
      if (error) throw new Error(`Falha ao proteger imagens: ${error.message}`)
      ;(data ?? []).forEach((item, index) => {
        const reference = authorized[index]
        if (reference && item.signedUrl) result.set(reference.value, item.signedUrl)
      })
      return result
    },

    async signStoredImageUrlsForUser(userId: string, records: StoredImageProvenance[]) {
      const result = new Map<string, string>()
      const authorizedByPath = new Map<string, AuthorizedStorageReference>()
      for (const record of records) {
        const reference = authorizeStoredImageForUser(userId, record)
        if (reference) authorizedByPath.set(reference.objectPath, reference)
        else {
          const local = classifyStorageReference(record.value, userId, policyConfig())
          if (storedImageProvenances.has(record) && record.ownerId === userId && local.kind === 'legacy-local-public') {
            result.set(local.value, local.publicPath)
          }
        }
      }
      const authorized = [...authorizedByPath.values()]
      if (!authorized.length) return result
      const { data, error } = await getStorage().from(bucket).createSignedUrls(authorized.map(item => item.objectPath), 60 * 60)
      if (error) throw new Error(`Falha ao proteger imagens: ${error.message}`)
      ;(data ?? []).forEach((item, index) => {
        const reference = authorized[index]
        if (reference && item.signedUrl) result.set(reference.value, item.signedUrl)
      })
      return result
    },

    async removePreparedImages(references: Array<PreparedImageRemoval | null | undefined>) {
      const authorized = references.filter((reference): reference is PreparedImageRemoval => Boolean(reference && preparedRemovals.has(reference)))
      const paths = [...new Set(authorized.map(reference => reference.objectPath))]
      if (!paths.length) return
      const { error } = await getStorage().from(bucket).remove(paths)
      if (error) throw new Error(`Falha ao remover imagem: ${error.message}`)
      authorized.forEach(reference => preparedRemovals.delete(reference))
    },

    async removeImagesForUser(userId: string, values: Array<string | null | undefined>) {
      const references = values.map(value => prepareImageRemovalForUser(userId, value))
      await operations.removePreparedImages(references)
    },

    async removeStoredImagesForUser(userId: string, records: StoredImageProvenance[]) {
      const references = records.map(record => prepareStoredImageRemovalForUser(userId, record))
      await operations.removePreparedImages(references)
    },
  }
  return operations
}

const authorizedStorage = createStorageAuthorizationOperations()
export const signImageUrlsForUser = authorizedStorage.signImageUrlsForUser
export const signStoredImageUrlsForUser = authorizedStorage.signStoredImageUrlsForUser
export const removePreparedImages = authorizedStorage.removePreparedImages
export const removeImagesForUser = authorizedStorage.removeImagesForUser
export const removeStoredImagesForUser = authorizedStorage.removeStoredImagesForUser

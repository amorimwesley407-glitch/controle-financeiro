import { createClient } from '@supabase/supabase-js'

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'finance-uploads'
const storagePrefix = `supabase-storage://${bucket}/`

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage
}

export async function uploadImage(file: File, userId: string, folder: string) {
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

function objectPathFromValue(value: string | null | undefined) {
  if (!value) return null
  if (value.startsWith(storagePrefix)) return value.slice(storagePrefix.length)
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = value.indexOf(marker)
  return index < 0 ? null : value.slice(index + marker.length)
}

// Só o formato gerado por uploadImage: <userId>/<pasta>/<uuid>.<ext>, sem "..", "%" ou barras extras.
const ownedPath = /^([A-Za-z0-9_-]+)\/(profile-images|category-icons|transaction-images)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|avif)$/

// Imagens anteriores à pasta por usuário: legacy/<pasta>/<8 primeiros caracteres do id do dono>-<uuid>.<ext>.
const legacyPath = /^legacy\/(?:profile-images|category-icons|transaction-images)\/([A-Za-z0-9_-]{8})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp|avif)$/

/** Caminho do objeto no Storage, só se ele pertencer a `userId`. Qualquer outra coisa vira null. */
export function ownedObjectPath(value: string | null | undefined, userId: string) {
  const path = objectPathFromValue(value)
  if (!path || !userId) return null
  if (ownedPath.exec(path)?.[1] === userId) return path
  return legacyPath.exec(path)?.[1] === userId.slice(0, 8) ? path : null
}

/**
 * Gera links temporários só para imagens que pertencem a `userId`.
 * Valores de outro usuário ou em formato desconhecido ficam sem imagem.
 */
export async function signImageUrls(values: Array<string | null | undefined>, userId: string) {
  const paths = [...new Set(values.map(value => ownedObjectPath(value, userId)).filter((value): value is string => Boolean(value)))]
  const signed = new Map<string, string>()
  if (!paths.length) return signed
  const { data, error } = await storage().from(bucket).createSignedUrls(paths, 60 * 60)
  if (error) throw new Error(`Falha ao proteger imagens: ${error.message}`)
  data.forEach((item, index) => { if (item.signedUrl) signed.set(paths[index], item.signedUrl) })
  return new Map(values.flatMap(value => {
    const path = ownedObjectPath(value, userId)
    const url = path && signed.get(path)
    return value && url ? [[value, url] as const] : []
  }))
}

/** Apaga a imagem do Storage, só se ela estiver na pasta de `userId`; caso contrário não faz nada. */
export async function removeImage(value: string | null | undefined, userId: string) {
  const objectPath = ownedObjectPath(value, userId)
  if (!objectPath) return
  const { error } = await storage().from(bucket).remove([objectPath])
  if (error) throw new Error(`Falha ao remover imagem: ${error.message}`)
}

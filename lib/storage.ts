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
  return index < 0 ? null : decodeURIComponent(value.slice(index + marker.length))
}

export async function signImageUrls(values: Array<string | null | undefined>) {
  const paths = [...new Set(values.map(objectPathFromValue).filter((value): value is string => Boolean(value)))]
  const signed = new Map<string, string>()
  if (!paths.length) return signed
  const { data, error } = await storage().from(bucket).createSignedUrls(paths, 60 * 60)
  if (error) throw new Error(`Falha ao proteger imagens: ${error.message}`)
  data.forEach((item, index) => { if (item.signedUrl) signed.set(paths[index], item.signedUrl) })
  return new Map(values.flatMap(value => {
    const path = objectPathFromValue(value)
    if (!value) return []
    if (!path) return [[value, value] as const] // compatibilidade com arquivos estáticos locais
    const url = signed.get(path)
    return url ? [[value, url] as const] : []
  }))
}

export async function removeImage(value: string | null | undefined) {
  const objectPath = objectPathFromValue(value)
  if (!objectPath) return
  const { error } = await storage().from(bucket).remove([objectPath])
  if (error) throw new Error(`Falha ao remover imagem: ${error.message}`)
}

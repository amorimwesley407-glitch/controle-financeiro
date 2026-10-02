import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { classifyStorageReference, isAuthorizedStorageReference } from './storage-policy'

export const localStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'finance-uploads'

function filePath(objectPath: string) {
  const ownerId = objectPath.split('/')[0]
  const reference = classifyStorageReference(`local-storage://${localStorageBucket}/${objectPath}`, ownerId, { bucket: localStorageBucket })
  if (!isAuthorizedStorageReference(reference)) throw new Error('Caminho de imagem inválido')
  const root = path.resolve(process.env.LOCAL_STORAGE_DIR || '.local/uploads')
  return path.join(root, reference.objectPath)
}

export async function readLocalImage(objectPath: string, userId: string) {
  const reference = classifyStorageReference(`local-storage://${localStorageBucket}/${objectPath}`, userId, { bucket: localStorageBucket })
  if (!isAuthorizedStorageReference(reference)) return null
  try {
    const bytes = await readFile(filePath(reference.objectPath))
    const extension = reference.fileName.split('.').pop()!
    const contentType = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' }[extension]
    return { bytes, contentType: contentType! }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export function localStorage() {
  return {
    from(bucket: string) {
      if (bucket !== localStorageBucket) throw new Error('Bucket local inválido')
      return {
        async upload(objectPath: string, bytes: Uint8Array, options: { contentType: string; upsert: boolean }) {
          if (options.upsert) throw new Error('Sobrescrita de imagens não permitida')
          const destination = filePath(objectPath)
          await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
          await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 })
          return { error: null }
        },
        async createSignedUrls(paths: string[]) {
          return { data: paths.map(objectPath => {
            filePath(objectPath)
            // A sessão é validada a cada leitura pela rota privada.
            return { signedUrl: `/api/uploads/${objectPath.split('/').map(encodeURIComponent).join('/')}` }
          }), error: null }
        },
        async remove(paths: string[]) {
          for (const objectPath of paths) {
            try {
              await unlink(filePath(objectPath))
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
            }
          }
          return { error: null }
        },
      }
    },
  }
}

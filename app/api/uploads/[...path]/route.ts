import { auth } from '@/lib/auth'
import { readLocalImage } from '@/lib/local-storage'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  if (process.env.STORAGE_PROVIDER !== 'local') return new Response(null, { status: 404, headers })
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return new Response(null, { status: 401, headers })
  const params = await context.params
  const image = await readLocalImage(params.path.join('/'), session.user.id)
  if (!image) return new Response(null, { status: 404, headers })
  return new Response(new Uint8Array(image.bytes), { headers: { ...headers, 'Content-Type': image.contentType } })
}

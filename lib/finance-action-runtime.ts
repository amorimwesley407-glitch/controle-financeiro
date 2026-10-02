import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import {
  createStoredImageProvenance,
  prepareImageRemovalForUser,
  prepareStoredImageRemovalForUser,
  removePreparedImages,
  uploadImage,
} from '@/lib/storage'

export const financeImageActionRuntime = {
  async getUserId() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error('Não autorizado')
    return session.user.id
  },
  createStoredImageProvenance,
  prepareImageRemovalForUser,
  prepareStoredImageRemovalForUser,
  removePreparedImages,
  uploadImage,
  revalidatePath,
}

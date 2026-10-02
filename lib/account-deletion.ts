import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { createStoredImageProvenance, removeStoredImagesForUser, type StoredImageProvenance } from '@/lib/storage'

type DeletedUser = { id: string; image?: string | null }

type AccountDeletionDependencies = {
  loadCategoryImages: (userId: string) => Promise<StoredImageProvenance[]>
  loadTransactionImages: (userId: string) => Promise<StoredImageProvenance[]>
  removeImages: (userId: string, values: StoredImageProvenance[]) => Promise<void>
  deleteFinancialData: (userId: string) => Promise<void>
}

export function createAccountDeletionCleanup(dependencies: AccountDeletionDependencies) {
  return async (user: DeletedUser) => {
    const [categoryImages, transactionImages] = await Promise.all([
      dependencies.loadCategoryImages(user.id),
      dependencies.loadTransactionImages(user.id),
    ])
    await dependencies.removeImages(user.id, [
      ...categoryImages,
      ...transactionImages,
      createStoredImageProvenance(user.id, user.image),
    ])
    await dependencies.deleteFinancialData(user.id)
  }
}

export const cleanupUserBeforeDelete = createAccountDeletionCleanup({
  async loadCategoryImages(userId) {
    const rows = await db.select({ userId: schema.categories.userId, imagePath: schema.categories.imagePath }).from(schema.categories).where(eq(schema.categories.userId, userId))
    return rows.map(item => createStoredImageProvenance(item.userId, item.imagePath))
  },
  async loadTransactionImages(userId) {
    const rows = await db.select({ userId: schema.transactions.userId, imagePath: schema.transactions.imagePath }).from(schema.transactions).where(eq(schema.transactions.userId, userId))
    return rows.map(item => createStoredImageProvenance(item.userId, item.imagePath))
  },
  removeImages: removeStoredImagesForUser,
  async deleteFinancialData(userId) {
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId))
    await db.delete(schema.budgets).where(eq(schema.budgets.userId, userId))
    await db.delete(schema.goals).where(eq(schema.goals.userId, userId))
    await db.delete(schema.holdings).where(eq(schema.holdings.userId, userId))
    await db.delete(schema.categories).where(eq(schema.categories.userId, userId))
  },
})

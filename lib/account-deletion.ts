import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { removeImagesForUser } from '@/lib/storage'

type DeletedUser = { id: string; image?: string | null }

type AccountDeletionDependencies = {
  loadCategoryImages: (userId: string) => Promise<Array<string | null>>
  loadTransactionImages: (userId: string) => Promise<Array<string | null>>
  removeImages: (userId: string, values: Array<string | null | undefined>) => Promise<void>
  deleteFinancialData: (userId: string) => Promise<void>
}

export function createAccountDeletionCleanup(dependencies: AccountDeletionDependencies) {
  return async (user: DeletedUser) => {
    const [categoryImages, transactionImages] = await Promise.all([
      dependencies.loadCategoryImages(user.id),
      dependencies.loadTransactionImages(user.id),
    ])
    await dependencies.removeImages(user.id, [...categoryImages, ...transactionImages, user.image])
    await dependencies.deleteFinancialData(user.id)
  }
}

export const cleanupUserBeforeDelete = createAccountDeletionCleanup({
  async loadCategoryImages(userId) {
    const rows = await db.select({ imagePath: schema.categories.imagePath }).from(schema.categories).where(eq(schema.categories.userId, userId))
    return rows.map(item => item.imagePath)
  },
  async loadTransactionImages(userId) {
    const rows = await db.select({ imagePath: schema.transactions.imagePath }).from(schema.transactions).where(eq(schema.transactions.userId, userId))
    return rows.map(item => item.imagePath)
  },
  removeImages: removeImagesForUser,
  async deleteFinancialData(userId) {
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId))
    await db.delete(schema.budgets).where(eq(schema.budgets.userId, userId))
    await db.delete(schema.goals).where(eq(schema.goals.userId, userId))
    await db.delete(schema.holdings).where(eq(schema.holdings.userId, userId))
    await db.delete(schema.categories).where(eq(schema.categories.userId, userId))
  },
})

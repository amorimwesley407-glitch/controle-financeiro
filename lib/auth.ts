import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { removeImage } from '@/lib/storage'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins: [
    'http://localhost:3000',
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  emailAndPassword: { enabled: true, autoSignIn: true },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const [userCategories, userTransactions] = await Promise.all([
          db.select({ imagePath: schema.categories.imagePath }).from(schema.categories).where(eq(schema.categories.userId, user.id)),
          db.select({ imagePath: schema.transactions.imagePath }).from(schema.transactions).where(eq(schema.transactions.userId, user.id)),
        ])
        await Promise.all([
          ...userCategories.map((item) => removeImage(item.imagePath)),
          ...userTransactions.map((item) => removeImage(item.imagePath)),
          removeImage(user.image),
        ])
        await db.delete(schema.transactions).where(eq(schema.transactions.userId, user.id))
        await db.delete(schema.budgets).where(eq(schema.budgets.userId, user.id))
        await db.delete(schema.goals).where(eq(schema.goals.userId, user.id))
        await db.delete(schema.holdings).where(eq(schema.holdings.userId, user.id))
        await db.delete(schema.categories).where(eq(schema.categories.userId, user.id))
      },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: process.env.NODE_ENV === 'development' ? { defaultCookieAttributes: { sameSite: 'lax', secure: false } } : undefined,
})

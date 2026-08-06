import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { removeImage } from '@/lib/storage'

const toOrigin = (host: string | undefined) => {
  if (!host) return null
  return host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}`
}

const vercelOrigins = [
  toOrigin(process.env.VERCEL_URL),
  toOrigin(process.env.VERCEL_BRANCH_URL),
  toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
].filter((origin): origin is string => Boolean(origin))

const configuredAuthOrigin = toOrigin(process.env.BETTER_AUTH_URL)
const productionAuthOrigin = configuredAuthOrigin?.includes('localhost')
  ? vercelOrigins[0]
  : configuredAuthOrigin

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: productionAuthOrigin || vercelOrigins[0] || 'http://localhost:3000',
  trustedOrigins: [
    'http://localhost:3000',
    ...(configuredAuthOrigin ? [configuredAuthOrigin] : []),
    ...vercelOrigins,
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

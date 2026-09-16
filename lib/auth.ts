import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { blockGenericAuthImageInput } from '@/lib/auth-image-policy'
import { cleanupUserBeforeDelete } from '@/lib/account-deletion'

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
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
    ...(configuredAuthOrigin ? [configuredAuthOrigin] : []),
    ...vercelOrigins,
  ],
  hooks: {
    before: blockGenericAuthImageInput,
  },
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 12, maxPasswordLength: 128 },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60 * 60, max: 3 },
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: cleanupUserBeforeDelete,
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: process.env.NODE_ENV === 'development' ? { defaultCookieAttributes: { sameSite: 'lax', secure: false } } : undefined,
})

import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, boolean } from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}

export const user = pgTable('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false), image: text('image'), ...timestamps,
})
export const session = pgTable('session', {
  id: text('id').primaryKey(), expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(), token: text('token').notNull().unique(),
  ...timestamps, ipAddress: text('ipAddress'), userAgent: text('userAgent'), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})
export const account = pgTable('account', {
  id: text('id').primaryKey(), accountId: text('accountId').notNull(), providerId: text('providerId').notNull(), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'), refreshToken: text('refreshToken'), idToken: text('idToken'), accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }), scope: text('scope'), password: text('password'), ...timestamps,
})
export const verification = pgTable('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(), expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(), ...timestamps,
})
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), name: text('name').notNull(), type: text('type').notNull(),
  color: text('color').notNull().default('blue'), icon: text('icon').notNull().default('wallet'), imagePath: text('imagePath'), createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('categories_user_idx').on(t.userId), uniqueIndex('categories_user_name_type_idx').on(t.userId, t.name, t.type)])
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), categoryId: integer('categoryId').references(() => categories.id, { onDelete: 'set null' }),
  type: text('type').notNull(), description: text('description').notNull(), amountCents: integer('amountCents').notNull(), date: text('date').notNull(), notes: text('notes'), imagePath: text('imagePath'), recurring: boolean('recurring').notNull().default(false), createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('transactions_user_date_idx').on(t.userId, t.date), index('transactions_category_idx').on(t.categoryId)])
export const budgets = pgTable('budgets', { id: serial('id').primaryKey(), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), categoryId: integer('categoryId').references(() => categories.id, { onDelete: 'set null' }), name: text('name').notNull(), limitCents: integer('limitCents').notNull(), month: text('month').notNull(), createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow() }, t => [index('budgets_user_month_idx').on(t.userId, t.month)])
export const goals = pgTable('goals', { id: serial('id').primaryKey(), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), name: text('name').notNull(), targetCents: integer('targetCents').notNull(), currentCents: integer('currentCents').notNull().default(0), deadline: text('deadline'), createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow() }, t => [index('goals_user_idx').on(t.userId)])
export const holdings = pgTable('holdings', { id: serial('id').primaryKey(), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), symbol: text('symbol').notNull(), assetType: text('assetType').notNull(), quantity: text('quantity').notNull(), averageCostCents: integer('averageCostCents').notNull(), applicationDate: text('applicationDate'), createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow() }, t => [index('holdings_user_idx').on(t.userId)])

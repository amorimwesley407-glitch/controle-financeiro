import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL não foi definida')

// Supabase recomenda a conexão do pooler para workloads serverless como a Vercel.
const client = postgres(connectionString, { prepare: false, max: 1 })
export const db = drizzle(client, { schema })
export { client }

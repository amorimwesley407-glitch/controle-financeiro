import { client } from './index'
import { readdir, readFile } from 'node:fs/promises'

const migrationsDir = new URL('./migrations/', import.meta.url)

/** Aplica, em ordem, as migrações .sql ainda não registradas em "schema_migrations". Cada uma roda em transação. */
export async function initializeDatabase() {
  await client`CREATE TABLE IF NOT EXISTS "schema_migrations" ("name" text PRIMARY KEY, "appliedAt" timestamptz NOT NULL DEFAULT now())`
  const applied = new Set((await client`SELECT "name" FROM "schema_migrations"`).map(row => row.name as string))
  const files = (await readdir(migrationsDir)).filter(file => file.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(new URL(file, migrationsDir), 'utf8')
    await client.begin(async tx => {
      await tx.unsafe(sql)
      await tx`INSERT INTO "schema_migrations" ("name") VALUES (${file})`
    })
    console.log(`✓ Migração aplicada: ${file}`)
  }
  console.log('✓ Banco PostgreSQL atualizado')
  await client.end()
}

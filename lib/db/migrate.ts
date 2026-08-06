import { client } from './index'
import { readFile } from 'node:fs/promises'

export async function initializeDatabase() {
  const migration = await readFile(new URL('./migration.sql', import.meta.url), 'utf8')
  await client.unsafe(migration)
  console.log('✓ Banco PostgreSQL inicializado com sucesso')
  await client.end()
}

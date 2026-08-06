import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

async function main() {
  const { initializeDatabase } = await import('../lib/db/migrate')
  await initializeDatabase()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

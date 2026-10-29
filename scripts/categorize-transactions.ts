import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

// Uso: npm run db:categorize            (só mostra o que mudaria)
//      npm run db:categorize -- --apply  (grava no banco de DATABASE_URL)
// Só mexe em lançamentos sem categoria; os que já têm categoria ficam como estão.
async function main() {
  const apply = process.argv.includes('--apply')
  const { client } = await import('../lib/db')
  const { suggestCategory } = await import('../lib/categorize')

  const host = new URL(process.env.DATABASE_URL!).host
  const categories = await client`SELECT "id", "userId", "name", "type" FROM "categories"`
  const pending = await client`SELECT "id", "userId", "type", "description" FROM "transactions" WHERE "categoryId" IS NULL`

  const updates: { id: number; categoryId: number }[] = []
  const summary = new Map<string, number>()
  for (const row of pending) {
    const name = suggestCategory(row.description, row.type)
    const category = name && categories.find(item => item.userId === row.userId && item.type === row.type && item.name === name)
    const key = category ? `${category.name}` : `(sem regra) ${row.description}`
    summary.set(key, (summary.get(key) ?? 0) + 1)
    if (category) updates.push({ id: row.id, categoryId: category.id })
  }

  console.log(`Banco: ${host}`)
  console.table([...summary].sort((a, b) => b[1] - a[1]).map(([categoria, lancamentos]) => ({ categoria, lancamentos })))
  console.log(`${updates.length} de ${pending.length} lançamentos sem categoria receberiam uma.`)

  if (apply && updates.length) {
    await client.begin(async tx => {
      for (const { id, categoryId } of updates) await tx`UPDATE "transactions" SET "categoryId" = ${categoryId} WHERE "id" = ${id} AND "categoryId" IS NULL`
    })
    console.log(`✓ ${updates.length} lançamentos categorizados`)
  } else if (!apply) {
    console.log('Nada foi gravado. Rode com --apply para aplicar.')
  }
  await client.end()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

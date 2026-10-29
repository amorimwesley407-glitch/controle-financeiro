import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

// Uso: npm run db:categorize            (só mostra o que mudaria)
//      npm run db:categorize -- --apply  (grava no banco de DATABASE_URL)
//      ... --create-missing               (cria para cada usuário as categorias das regras que ele não tem)
// Só mexe em lançamentos sem categoria; os que já têm categoria ficam como estão.
async function main() {
  const apply = process.argv.includes('--apply')
  const createMissing = process.argv.includes('--create-missing')
  const { client } = await import('../lib/db')
  const { CATEGORY_RULES, findSuggestedCategory } = await import('../lib/categorize')
  const { defaultCategories } = await import('../lib/default-categories')

  const host = new URL(process.env.DATABASE_URL!).host
  if (createMissing) {
    const ruleCategories = [...new Map(CATEGORY_RULES.map(rule => [`${rule.type}:${rule.category}`, rule])).values()]
    const users = await client`SELECT DISTINCT "userId" FROM "categories"`
    const existing = await client`SELECT "userId", "name", "type" FROM "categories"`
    const toCreate = users.flatMap(({ userId }) => ruleCategories
      .filter(rule => !existing.some(item => item.userId === userId && item.type === rule.type && item.name === rule.category))
      .map(rule => {
        const style = defaultCategories.find(item => item.name === rule.category && item.type === rule.type)
        return { userId, name: rule.category, type: rule.type, color: style?.color ?? 'blue', icon: style?.icon ?? 'wallet' }
      }))
    for (const item of toCreate) console.log(`${apply ? '✓ Criando' : 'Criaria'} "${item.name}" para ${item.userId}`)
    if (apply && toCreate.length) await client`INSERT INTO "categories" ${client(toCreate)} ON CONFLICT DO NOTHING`
  }
  const categories = await client<{ id: number; userId: string; name: string; type: string }[]>`SELECT "id", "userId", "name", "type" FROM "categories"`
  const pending = await client`SELECT "id", "userId", "type", "description" FROM "transactions" WHERE "categoryId" IS NULL`

  const updates: { id: number; categoryId: number }[] = []
  const summary = new Map<string, number>()
  for (const row of pending) {
    const category = findSuggestedCategory(row.description, row.type, categories.filter(item => item.userId === row.userId))
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

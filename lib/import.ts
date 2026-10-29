type RowCategory = { type: string; categoryName?: string }
type ExistingCategory = { type: string; name: string }

const normalize = (text: string) => text.trim().toLocaleLowerCase('pt-BR')

export const MAX_NEW_CATEGORIES_PER_IMPORT = 50

/** Categorias citadas nas linhas importadas que o usuário ainda não tem (sem duplicar, ignorando maiúsculas). */
export function findMissingCategories(rows: RowCategory[], existing: ExistingCategory[]) {
  const known = new Set(existing.map(item => `${item.type}:${normalize(item.name)}`))
  const missing = new Map<string, { name: string; type: string }>()
  for (const row of rows) {
    const name = row.categoryName?.trim()
    if (!name) continue
    const key = `${row.type}:${normalize(name)}`
    if (!known.has(key) && !missing.has(key)) missing.set(key, { name, type: row.type })
  }
  return [...missing.values()]
}

/** Categoria do usuário que corresponde ao nome e ao tipo da linha importada. */
export function matchCategory<T extends ExistingCategory>(row: RowCategory, categories: T[]) {
  if (!row.categoryName?.trim()) return undefined
  return categories.find(item => item.type === row.type && normalize(item.name) === normalize(row.categoryName!))
}

type TransactionKey = { type: string; date: string; amountCents: number; description: string }
const transactionKey = (row: TransactionKey) => [row.type, row.date, row.amountCents, normalize(row.description).replace(/\s+/g, ' ')].join('|')

/**
 * Separa as linhas importadas que já existem (mesmo tipo, data, valor e descrição, ignorando maiúsculas e espaços).
 * Conta repetições: se o arquivo tem duas linhas iguais e o banco só uma, a segunda entra.
 */
export function skipExistingTransactions<T extends TransactionKey>(rows: T[], existing: TransactionKey[]) {
  const available = new Map<string, number>()
  for (const item of existing) available.set(transactionKey(item), (available.get(transactionKey(item)) ?? 0) + 1)
  const fresh: T[] = []
  let skipped = 0
  for (const row of rows) {
    const key = transactionKey(row)
    const count = available.get(key) ?? 0
    if (count > 0) { available.set(key, count - 1); skipped++ } else fresh.push(row)
  }
  return { fresh, skipped }
}

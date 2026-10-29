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

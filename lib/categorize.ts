/** Remove acentos e padroniza para comparar descrições digitadas de jeitos diferentes. */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

type Rule = { type: 'expense' | 'income'; category: string; pattern: RegExp }

// A ordem importa: a primeira regra que casar define a categoria.
export const CATEGORY_RULES: Rule[] = [
  { type: 'income', category: 'Salário', pattern: /\bsalario\b/ },
  { type: 'income', category: 'Renda extra', pattern: /\bvale[\s-]?transporte\b/ },
  { type: 'expense', category: 'Presentes', pattern: /\b(doacao|presente|dia?s? das maes|rifa)\b/ },
  { type: 'expense', category: 'Cartão de crédito', pattern: /\b(fatura|seguro do cartao|anuidade)\b/ },
  { type: 'expense', category: 'Transporte', pattern: /\b(g(a)?solina|combustivel|shell|uber|99|seguro do carro|insulfilme|amortecedor)\b/ },
  { type: 'expense', category: 'Saúde', pattern: /\b(wellhub|gympass|farmacia|soro|seringa|consulta|exame|whey)\b/ },
  { type: 'expense', category: 'Moradia', pattern: /\b(internet|claro|vivo|aluguel|areia|arreia|luz|agua)\b/ },
  { type: 'expense', category: 'Alimentação', pattern: /\b(ifood|pizza|mac|mcdonalds|cocada|sorvete|barras?[\s-]cereal|churras|marmita|misto ?quente|bolo|padaria|almoco|jantar|creme e tridente|mercado)\b/ },
  { type: 'expense', category: 'Lazer', pattern: /\b(role|ps4|ps5|cinema)\b/ },
  { type: 'expense', category: 'Cuidados pessoais', pattern: /\b(barbeiro|barbearia|corte de cabelo|cabeleireiro|manicure|perfume)\b/ },
  { type: 'expense', category: 'Compras', pattern: /\b(meli|roupas?|shopp?e|shopee|fonte do pc|racao|travesseiro)\b/ },
]

/** Nome da categoria sugerida para a descrição, ou undefined quando nenhuma regra se aplica. */
export function suggestCategory(description: string, type: string) {
  const text = normalize(description)
  return CATEGORY_RULES.find(rule => rule.type === type && rule.pattern.test(text))?.category
}

type CategoryLike = { name: string; type: string }

/** Categoria do usuário sugerida pelas regras. Pula regras cuja categoria o usuário não tem. */
export function findSuggestedCategory<T extends CategoryLike>(description: string, type: string, categories: T[]) {
  const text = normalize(description)
  for (const rule of CATEGORY_RULES) {
    if (rule.type !== type || !rule.pattern.test(text)) continue
    const match = categories.find(item => item.type === type && normalize(item.name) === normalize(rule.category))
    if (match) return match
  }
  return undefined
}

type LearnedRow = { description: string; type: string; categoryId: number | null }
const learnKey = (text: string) => normalize(text).replace(/\s+/g, ' ')

/**
 * Categoria aprendida com os lançamentos do próprio usuário: a do lançamento mais recente com a mesma descrição e tipo.
 * `history` deve vir do mais recente para o mais antigo, para uma correção valer nos próximos.
 */
export function findLearnedCategory<T extends { id: number; type: string }>(description: string, type: string, history: LearnedRow[], categories: T[]) {
  const key = learnKey(description)
  const match = history.find(row => row.categoryId !== null && row.type === type && learnKey(row.description) === key)
  return match ? categories.find(item => item.id === match.categoryId && item.type === type) : undefined
}

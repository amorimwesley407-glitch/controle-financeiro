/** Remove acentos e padroniza para comparar descrições digitadas de jeitos diferentes. */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

type Rule = { type: 'expense' | 'income'; category: string; pattern: RegExp }

// A ordem importa: a primeira regra que casar define a categoria.
// "fatura" e "seguro do cartão" ficam de fora de propósito: são pagamentos do cartão, não um tipo de gasto.
export const CATEGORY_RULES: Rule[] = [
  { type: 'income', category: 'Salário', pattern: /\bsalario\b/ },
  { type: 'income', category: 'Renda extra', pattern: /\bvale[\s-]?transporte\b/ },
  { type: 'expense', category: 'Presentes', pattern: /\b(doacao|presente|dia?s? das maes|rifa)\b/ },
  { type: 'expense', category: 'Transporte', pattern: /\b(g(a)?solina|combustivel|shell|uber|99|seguro do carro|insulfilme|amortecedor)\b/ },
  { type: 'expense', category: 'Saúde', pattern: /\b(wellhub|gympass|farmacia|soro|seringa|consulta|exame|whey)\b/ },
  { type: 'expense', category: 'Moradia', pattern: /\b(internet|claro|vivo|aluguel|areia|arreia|luz|agua)\b/ },
  { type: 'expense', category: 'Alimentação', pattern: /\b(ifood|pizza|mac|mcdonalds|cocada|sorvete|barras?[\s-]cereal|churras|marmita|misto ?quente|bolo|padaria|almoco|jantar|creme e tridente|mercado)\b/ },
  { type: 'expense', category: 'Lazer', pattern: /\b(role|ps4|ps5|cinema)\b/ },
  { type: 'expense', category: 'Compras', pattern: /\b(meli|perfume|roupas?|shopp?e|shopee|fonte do pc|racao|corte de cabelo|barbeiro|travesseiro)\b/ },
]

/** Nome da categoria sugerida para a descrição, ou undefined quando nenhuma regra se aplica. */
export function suggestCategory(description: string, type: string) {
  const text = normalize(description)
  return CATEGORY_RULES.find(rule => rule.type === type && rule.pattern.test(text))?.category
}

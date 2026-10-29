import { describe, expect, it } from 'vitest'
import { findSuggestedCategory, suggestCategory } from './categorize'

describe('suggestCategory', () => {
  it.each([
    ['Gasolina', 'expense', 'Transporte'],
    ['gsolina', 'expense', 'Transporte'],
    ['Combustível', 'expense', 'Transporte'],
    ['iFood sorvete', 'expense', 'Alimentação'],
    ['Mac', 'expense', 'Alimentação'],
    ['barras-cereal', 'expense', 'Alimentação'],
    ['Mistoquente', 'expense', 'Alimentação'],
    ['Wellhub', 'expense', 'Saúde'],
    ['Soro fisiológico e seringa', 'expense', 'Saúde'],
    ['Consulta da mãe', 'expense', 'Saúde'],
    ['Internet', 'expense', 'Moradia'],
    ['Doação', 'expense', 'Presentes'],
    ['Bolsa presente mãe', 'expense', 'Presentes'],
    ['Dias das mães', 'expense', 'Presentes'],
    ['Rifa-filha-joilma', 'expense', 'Presentes'],
    ['Meli +', 'expense', 'Compras'],
    ['Barbeiro', 'expense', 'Cuidados pessoais'],
    ['Corte de cabelo', 'expense', 'Cuidados pessoais'],
    ['Perfume Touti', 'expense', 'Cuidados pessoais'],
    ['Ração Bolinha', 'expense', 'Compras'],
    ['Cabo flat PS4', 'expense', 'Lazer'],
    ['Salário', 'income', 'Salário'],
    ['Sálario', 'income', 'Salário'],
    ['Vale-transporte', 'income', 'Renda extra'],
    ['vale transporte', 'income', 'Renda extra'],
  ])('%s → %s', (description, type, expected) => {
    expect(suggestCategory(description, type)).toBe(expected)
  })

  it('não categoriza pagamentos do cartão nem descrições desconhecidas', () => {
    expect(suggestCategory('Fatura', 'expense')).toBeUndefined()
    expect(suggestCategory('Seguro do cartão', 'expense')).toBeUndefined()
    expect(suggestCategory('Tay', 'expense')).toBeUndefined()
  })

  it('respeita o tipo do lançamento', () => {
    expect(suggestCategory('Salário', 'expense')).toBeUndefined()
    expect(suggestCategory('Gasolina', 'income')).toBeUndefined()
  })

  it('não confunde palavras parecidas', () => {
    expect(suggestCategory('Macarrão', 'expense')).toBeUndefined()
    expect(suggestCategory('Claridade', 'expense')).toBeUndefined()
  })
})

describe('findSuggestedCategory', () => {
  const categories = [
    { id: 1, name: 'Transporte', type: 'expense' },
    { id: 2, name: 'Compras', type: 'expense' },
    { id: 3, name: 'salário', type: 'income' },
  ]

  it('devolve a categoria do usuário correspondente à regra', () => {
    expect(findSuggestedCategory('Uber', 'expense', categories)?.id).toBe(1)
    expect(findSuggestedCategory('Salário', 'income', categories)?.id).toBe(3)
  })

  it('não sugere nada quando o usuário não tem a categoria da regra', () => {
    expect(findSuggestedCategory('Barbeiro', 'expense', categories)).toBeUndefined()
    expect(findSuggestedCategory('iFood', 'expense', categories)).toBeUndefined()
  })
})

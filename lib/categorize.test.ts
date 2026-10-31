import { describe, expect, it } from 'vitest'
import { findLearnedCategory, findSuggestedCategory, suggestCategory } from './categorize'

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
    ['Rifa da escola', 'expense', 'Presentes'],
    ['Fatura', 'expense', 'Cartão de crédito'],
    ['Seguro do Cartão', 'expense', 'Cartão de crédito'],
    ['Seguro do carro', 'expense', 'Transporte'],
    ['Meli +', 'expense', 'Compras'],
    ['Barbeiro', 'expense', 'Cuidados pessoais'],
    ['Corte de cabelo', 'expense', 'Cuidados pessoais'],
    ['Perfume importado', 'expense', 'Cuidados pessoais'],
    ['Ração do cachorro', 'expense', 'Compras'],
    ['Cabo flat PS4', 'expense', 'Lazer'],
    ['Salário', 'income', 'Salário'],
    ['Sálario', 'income', 'Salário'],
    ['Vale-transporte', 'income', 'Renda extra'],
    ['vale transporte', 'income', 'Renda extra'],
  ])('%s → %s', (description, type, expected) => {
    expect(suggestCategory(description, type)).toBe(expected)
  })

  it('não categoriza descrições desconhecidas', () => {
    expect(suggestCategory('Pix diversos', 'expense')).toBeUndefined()
    expect(suggestCategory('Taylor', 'expense')).toBeUndefined()
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

describe('findLearnedCategory', () => {
  const categories = [{ id: 1, type: 'expense' }, { id: 2, type: 'expense' }, { id: 3, type: 'income' }]
  const row = (description: string, categoryId: number | null, type = 'expense') => ({ description, type, categoryId })

  it('usa o lançamento mais recente, ignorando maiúsculas, acentos e espaços', () => {
    const history = [row('Padaria  São João', 2), row('padaria sao joao', 1)]
    expect(findLearnedCategory('PADARIA SÃO JOÃO', 'expense', history, categories)?.id).toBe(2)
  })
  it('não aprende de outro tipo, de lançamento sem categoria nem de categoria que não existe mais', () => {
    expect(findLearnedCategory('Pix', 'expense', [row('Pix', 3, 'income')], categories)).toBeUndefined()
    expect(findLearnedCategory('Pix', 'expense', [row('Pix', null)], categories)).toBeUndefined()
    expect(findLearnedCategory('Pix', 'expense', [row('Pix', 99)], categories)).toBeUndefined()
    expect(findLearnedCategory('Pix', 'expense', [row('Pix', 3)], categories)).toBeUndefined()
  })
})

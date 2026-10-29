import { describe, expect, it } from 'vitest'
import { findMissingCategories, matchCategory, skipExistingTransactions } from './import'

const existing = [{ id: 1, name: 'Mercado', type: 'expense' }, { id: 2, name: 'Salário', type: 'income' }]

describe('findMissingCategories', () => {
  it('lista só o que o usuário ainda não tem, sem duplicar', () => {
    const rows = [
      { type: 'expense', categoryName: 'Mercado' },
      { type: 'expense', categoryName: 'Farmácia' },
      { type: 'expense', categoryName: ' farmácia ' },
      { type: 'income', categoryName: 'Freelance' },
    ]
    expect(findMissingCategories(rows, existing)).toEqual([
      { name: 'Farmácia', type: 'expense' },
      { name: 'Freelance', type: 'income' },
    ])
  })
  it('ignora maiúsculas e espaços ao comparar com as existentes', () => {
    expect(findMissingCategories([{ type: 'expense', categoryName: '  MERCADO ' }], existing)).toEqual([])
  })
  it('mesmo nome em tipos diferentes são categorias diferentes', () => {
    expect(findMissingCategories([{ type: 'income', categoryName: 'Mercado' }], existing)).toEqual([{ name: 'Mercado', type: 'income' }])
  })
  it('linhas sem categoria não criam nada', () => {
    expect(findMissingCategories([{ type: 'expense' }, { type: 'expense', categoryName: '  ' }], existing)).toEqual([])
  })
})

describe('matchCategory', () => {
  it('acha pelo nome e tipo, ignorando maiúsculas', () => {
    expect(matchCategory({ type: 'expense', categoryName: 'mercado' }, existing)?.id).toBe(1)
  })
  it('não acha categoria de outro tipo nem sem nome', () => {
    expect(matchCategory({ type: 'income', categoryName: 'Mercado' }, existing)).toBeUndefined()
    expect(matchCategory({ type: 'expense' }, existing)).toBeUndefined()
  })
})

describe('skipExistingTransactions', () => {
  const row = (description: string, amountCents = 2698, date = '2026-03-02', type = 'expense') => ({ description, type, date, amountCents })

  it('pula o que já existe, ignorando maiúsculas e espaços', () => {
    const existing = [row('Ifood'), row('Gasolina', 10000, '2026-03-04')]
    const { fresh, skipped } = skipExistingTransactions([row(' IFOOD '), row('Gasolina', 10000, '2026-03-04'), row('Internet', 5000)], existing)
    expect(skipped).toBe(2)
    expect(fresh).toEqual([row('Internet', 5000)])
  })

  it('não confunde lançamentos com data, valor ou tipo diferentes', () => {
    const existing = [row('Ifood')]
    const rows = [row('Ifood', 2699), row('Ifood', 2698, '2026-03-03'), row('Ifood', 2698, '2026-03-02', 'income')]
    expect(skipExistingTransactions(rows, existing)).toEqual({ fresh: rows, skipped: 0 })
  })

  it('conta repetições: duas compras iguais no arquivo e uma no banco importa só a segunda', () => {
    const { fresh, skipped } = skipExistingTransactions([row('Ifood'), row('Ifood')], [row('Ifood')])
    expect(skipped).toBe(1)
    expect(fresh).toHaveLength(1)
  })
})

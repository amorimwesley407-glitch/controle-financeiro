import { describe, expect, it } from 'vitest'
import { findMissingCategories, matchCategory } from './import'

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

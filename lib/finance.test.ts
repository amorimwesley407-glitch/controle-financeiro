import { describe, expect, it } from 'vitest'
import { getBudgetAlerts } from './finance'

const categories = [{ id: 1, name: 'Mercado' }, { id: 2, name: 'Lazer' }]
const tx = (over: Partial<Parameters<typeof getBudgetAlerts>[0][number]>) => ({
  type: 'expense', amountCents: 1000, date: '2026-10-05', categoryId: 1, ...over,
})
const budget = (over = {}) => ({ name: 'Mercado', limitCents: 10000, month: '2026-10', categoryId: 1, ...over })

describe('getBudgetAlerts', () => {
  it('só alerta a partir de 70% do limite', () => {
    expect(getBudgetAlerts([tx({ amountCents: 6900 })], [budget()], categories, '2026-10-10')).toEqual([])
    const [alert] = getBudgetAlerts([tx({ amountCents: 7000 })], [budget()], categories, '2026-10-10')
    expect(alert.percentage).toBe(70)
    expect(alert.spent).toBe(7000)
  })
  it('passa de 100% quando estoura o limite', () => {
    const [alert] = getBudgetAlerts([tx({ amountCents: 15000 })], [budget()], categories, '2026-10-10')
    expect(alert.percentage).toBe(150)
  })
  it('ignora receitas, outros meses, outras categorias e datas futuras', () => {
    const txs = [
      tx({ type: 'income', amountCents: 9000 }),
      tx({ date: '2026-09-30', amountCents: 9000 }),
      tx({ categoryId: 2, amountCents: 9000 }),
      tx({ date: '2026-10-20', amountCents: 9000 }),
    ]
    expect(getBudgetAlerts(txs, [budget()], categories, '2026-10-10')).toEqual([])
  })
  it('sem categoryId, casa a categoria pelo nome sem diferenciar maiúsculas', () => {
    const [alert] = getBudgetAlerts([tx({ amountCents: 8000 })], [budget({ categoryId: null, name: ' mercado ' })], categories, '2026-10-10')
    expect(alert.spent).toBe(8000)
  })
  it('ordena do mais crítico para o menos crítico', () => {
    const budgets = [budget({ name: 'Mercado' }), budget({ name: 'Lazer', categoryId: 2 })]
    const txs = [tx({ amountCents: 8000 }), tx({ categoryId: 2, amountCents: 9500 })]
    expect(getBudgetAlerts(txs, budgets, categories, '2026-10-10').map(a => a.name)).toEqual(['Lazer', 'Mercado'])
  })
})

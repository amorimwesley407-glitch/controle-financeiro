import { describe, expect, it } from 'vitest'
import { compoundProjection, getBudgetAlerts, getHoldingPerformance, getMonthlyForecast, getSpendingAlerts } from './finance'

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

describe('getMonthlyForecast', () => {
  const txs = [
    { type: 'income', amountCents: 500000, date: '2026-10-01' },
    { type: 'expense', amountCents: 100000, date: '2026-10-05' },
    { type: 'expense', amountCents: 30000, date: '2026-10-20' },
    { type: 'income', amountCents: 20000, date: '2026-10-25' },
    { type: 'expense', amountCents: 80000, date: '2026-11-05' },
  ]
  it('no mês atual separa o realizado (até hoje) do que ainda vai vencer', () => {
    const f = getMonthlyForecast(txs, '2026-10', '2026-10-10')
    expect(f.realizedIncome).toBe(500000)
    expect(f.realizedExpense).toBe(100000)
    expect(f.pendingIncome).toBe(20000)
    expect(f.pendingExpense).toBe(30000)
    expect(f.projectedBalance).toBe(500000 - 100000 + 20000 - 30000)
    expect(f.futureTransactions).toHaveLength(2)
  })
  it('em mês futuro tudo é pendente', () => {
    const f = getMonthlyForecast(txs, '2026-11', '2026-10-10')
    expect(f.isFutureMonth).toBe(true)
    expect(f.realizedExpense).toBe(0)
    expect(f.pendingExpense).toBe(80000)
    expect(f.projectedBalance).toBe(-80000)
  })
  it('em mês passado tudo é realizado', () => {
    const f = getMonthlyForecast(txs, '2026-10', '2026-12-01')
    expect(f.futureTransactions).toHaveLength(0)
    expect(f.projectedBalance).toBe(500000 - 100000 + 20000 - 30000)
  })
  it('mês sem lançamentos fica zerado', () => {
    expect(getMonthlyForecast(txs, '2026-01', '2026-10-10').projectedBalance).toBe(0)
  })
})

describe('compoundProjection', () => {
  it('sem juros é só a soma dos aportes', () => {
    expect(compoundProjection(1000, 100, 0, 1)).toBe(1000 + 100 * 12)
  })
  it('sem aportes, 10% a.a. por 1 ano rende 10% (taxa efetiva anual)', () => {
    expect(compoundProjection(1000, 0, 10, 1)).toBe(1100)
  })
  it('com aportes rende mais que sem juros', () => {
    expect(compoundProjection(1000, 500, 10, 5)).toBeGreaterThan(1000 + 500 * 60)
  })
  it('período menor que 1 mês é tratado como 1 mês', () => {
    expect(compoundProjection(0, 100, 0, 0)).toBe(100)
  })
})

describe('getHoldingPerformance', () => {
  it('calcula lucro e variação percentual', () => {
    expect(getHoldingPerformance(10, 1000, 1200)).toEqual({ invested: 10000, currentValue: 12000, result: 2000, resultPercentage: 20 })
  })
  it('calcula prejuízo', () => {
    expect(getHoldingPerformance(2, 5000, 4000).result).toBe(-2000)
  })
  it('sem cotação não há resultado', () => {
    expect(getHoldingPerformance(10, 1000, null)).toEqual({ invested: 10000, currentValue: null, result: null, resultPercentage: null })
  })
  it('custo zero não gera divisão por zero', () => {
    expect(getHoldingPerformance(10, 0, 100).resultPercentage).toBeNull()
  })
})

describe('getSpendingAlerts', () => {
  it('pede cadastro de receita quando não há receita', () => {
    expect(getSpendingAlerts([], 0, 0, 0)).toEqual(['Cadastre uma receita para acompanhar sua capacidade de pagamento.'])
  })
  it('avisa despesas acima da receita e economia baixa', () => {
    const alerts = getSpendingAlerts([], 1000, 1500, -50)
    expect(alerts).toContain('Suas despesas acumuladas superaram as receitas.')
    expect(alerts).toContain('Sua taxa de economia está abaixo de 10%.')
  })
  it('avisa lançamento acima de 30% da receita', () => {
    const alerts = getSpendingAlerts([{ type: 'expense', amountCents: 4000, description: 'Notebook' }], 10000, 4000, 60)
    expect(alerts).toEqual(['O lançamento “Notebook” representa mais de 30% das receitas.'])
  })
  it('sem problemas devolve mensagem neutra', () => {
    expect(getSpendingAlerts([{ type: 'expense', amountCents: 100, description: 'Pão' }], 10000, 100, 99)).toEqual([
      'Nenhum alerta crítico identificado com os dados atuais.',
    ])
  })
})

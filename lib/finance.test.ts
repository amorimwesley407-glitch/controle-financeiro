import { describe, expect, it } from 'vitest'
import { compoundProjection, getBudgetAlerts, getCategoryComparison, getFixedExpenses, getHoldingPerformance, getMonthlyForecast, getSpendingAlerts } from './finance'

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

describe('getCategoryComparison', () => {
  const item = (date: string, amountCents: number, categoryName?: string, type = 'expense') => ({ type, amountCents, date, categoryName })

  it('compara cada categoria com o mês anterior e ordena pela maior diferença', () => {
    const result = getCategoryComparison([
      item('2026-09-05', 10000, 'Alimentação'),
      item('2026-10-05', 13500, 'Alimentação'),
      item('2026-09-10', 20000, 'Transporte'),
      item('2026-10-10', 12000, 'Transporte'),
      item('2026-10-12', 5000, 'Lazer'),
      item('2026-10-01', 200000, 'Salário', 'income'),
      item('2026-08-20', 99999, 'Alimentação'),
    ], '2026-10', '2026-11-15')
    expect(result.previousMonth).toBe('2026-09')
    expect(result.untilDay).toBeNull()
    expect(result.rows).toEqual([
      { name: 'Transporte', current: 12000, previous: 20000, difference: -8000, percentage: -40 },
      { name: 'Lazer', current: 5000, previous: 0, difference: 5000, percentage: null },
      { name: 'Alimentação', current: 13500, previous: 10000, difference: 3500, percentage: 35 },
    ])
    expect(result.totalCurrent).toBe(30500)
    expect(result.totalPrevious).toBe(30000)
  })

  it('no mês corrente compara só até o mesmo dia do mês anterior', () => {
    const result = getCategoryComparison([
      item('2026-09-10', 4000, 'Alimentação'),
      item('2026-09-25', 9000, 'Alimentação'),
      item('2026-10-08', 3000, 'Alimentação'),
      item('2026-10-20', 7000, 'Alimentação'),
    ], '2026-10', '2026-10-15')
    expect(result.untilDay).toBe(15)
    expect(result.rows).toEqual([{ name: 'Alimentação', current: 3000, previous: 4000, difference: -1000, percentage: -25 }])
  })

  it('vira o ano e agrupa lançamentos sem categoria', () => {
    const result = getCategoryComparison([item('2025-12-03', 1000), item('2026-01-03', 1500)], '2026-01', '2026-03-01')
    expect(result.previousMonth).toBe('2025-12')
    expect(result.rows).toEqual([{ name: 'Sem categoria', current: 1500, previous: 1000, difference: 500, percentage: 50 }])
  })
})

describe('getFixedExpenses', () => {
  const expense = (description: string, date: string, amountCents: number, extra = {}) => ({ type: 'expense', description, date, amountCents, ...extra })
  const monthly = (description: string, amountCents: number, monthsList: string[], day = '05') => monthsList.map(month => expense(description, `${month}-${day}`, amountCents))

  it('acha despesas que se repetem com valor estável e soma por mês', () => {
    const result = getFixedExpenses([
      ...monthly('WellHub', 9170, ['2026-07', '2026-08', '2026-09', '2026-10'], '01'),
      ...monthly('internet', 5000, ['2026-08', '2026-09'], '10'), expense('Internet ', '2026-10-10', 5200, { categoryName: 'Moradia' }),
      ...monthly('Fatura', 30000, ['2026-08', '2026-09']), expense('Fatura', '2026-10-05', 68000),
      ...monthly('Mercado', 15000, ['2026-08', '2026-10']),
      expense('Salário', '2026-10-05', 200000, { type: 'income' }), expense('Salário', '2026-09-05', 200000, { type: 'income' }),
    ], '2026-10-29')
    expect(result.items).toEqual([
      { description: 'WellHub', categoryName: undefined, monthlyCents: 9170, months: 4, lastDate: '2026-10-01', paidThisMonth: true },
      { description: 'Internet ', categoryName: 'Moradia', monthlyCents: 5200, months: 3, lastDate: '2026-10-10', paidThisMonth: true },
    ])
    expect(result.totalCents).toBe(14370)
    expect(result.averageIncomeCents).toBe(200000)
    expect(result.shareOfIncome).toBe(7)
  })

  it('deixa de fora o que parou de aparecer e marca o que ainda não caiu no mês', () => {
    const result = getFixedExpenses([
      ...monthly('Streaming', 3990, ['2026-05', '2026-06', '2026-07']),
      ...monthly('Barbeiro', 4000, ['2026-07', '2026-08', '2026-09']),
    ], '2026-10-29')
    expect(result.items.map(item => [item.description, item.paidThisMonth])).toEqual([['Barbeiro', false]])
  })

  it('aceita recorrente marcado com 2 meses, ignora lançamentos futuros e meses fora da janela', () => {
    const result = getFixedExpenses([
      expense('Academia', '2026-09-03', 12000, { recurring: true }), expense('Academia', '2026-10-03', 12000, { recurring: true }),
      expense('Academia', '2026-11-03', 12000, { recurring: true }),
      ...monthly('Antigo', 1000, ['2026-01', '2026-02', '2026-03', '2026-04']),
    ], '2026-10-29')
    expect(result.items.map(item => [item.description, item.months])).toEqual([['Academia', 2]])
    expect(result.shareOfIncome).toBeNull()
  })
})

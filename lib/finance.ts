type BudgetTx = { type: string; amountCents: number; date: string; categoryId: number | null; categoryName?: string }
type BudgetCategory = { id: number; name: string }
type BudgetItem = { name: string; limitCents: number; month: string; categoryId: number | null }

const normalize = (text: string) => text.trim().toLocaleLowerCase('pt-BR')

/** Orçamentos do mês de `currentDate` que já consumiram 70% ou mais do limite, do mais crítico ao menos. */
export function getBudgetAlerts<T extends BudgetItem>(
  transactions: BudgetTx[],
  budgets: T[],
  categories: BudgetCategory[],
  currentDate: string,
) {
  const currentMonth = currentDate.slice(0, 7)
  const monthTransactions = transactions.filter(item => item.date.startsWith(currentMonth))
  return budgets
    .filter(budget => budget.month === currentMonth)
    .map(budget => {
      const normalizedName = normalize(budget.name)
      const category = categories.find(item => (budget.categoryId ? item.id === budget.categoryId : normalize(item.name) === normalizedName))
      const spent = monthTransactions
        .filter(item =>
          item.type === 'expense' &&
          item.date <= currentDate &&
          (category ? item.categoryId === category.id : normalize(item.categoryName ?? '') === normalizedName))
        .reduce((sum, item) => sum + item.amountCents, 0)
      return { ...budget, spent, percentage: Math.round((spent / budget.limitCents) * 100) }
    })
    .filter(budget => budget.percentage >= 70)
    .sort((a, b) => b.percentage - a.percentage)
}

type ForecastTx = { type: string; amountCents: number; date: string }

/** Saldo realizado + lançamentos futuros de `selectedMonth` (AAAA-MM), em relação a `currentDate` (AAAA-MM-DD). */
export function getMonthlyForecast(transactions: ForecastTx[], selectedMonth: string, currentDate: string) {
  const currentMonth = currentDate.slice(0, 7)
  const monthTransactions = transactions.filter(item => item.date.startsWith(selectedMonth))
  const isCurrentMonth = selectedMonth === currentMonth
  const isFutureMonth = selectedMonth > currentMonth
  const futureTransactions = monthTransactions.filter(item => isFutureMonth || (isCurrentMonth && item.date > currentDate))
  const sumOf = (items: ForecastTx[], type: string) =>
    items.filter(item => item.type === type).reduce((sum, item) => sum + item.amountCents, 0)
  const realized = isFutureMonth ? [] : monthTransactions.filter(item => !isCurrentMonth || item.date <= currentDate)
  const realizedIncome = sumOf(realized, 'income')
  const realizedExpense = sumOf(realized, 'expense')
  const pendingIncome = sumOf(futureTransactions, 'income')
  const pendingExpense = sumOf(futureTransactions, 'expense')
  return {
    isCurrentMonth,
    isFutureMonth,
    monthTransactions,
    futureTransactions,
    realizedIncome,
    realizedExpense,
    pendingIncome,
    pendingExpense,
    projectedBalance: realizedIncome - realizedExpense + pendingIncome - pendingExpense,
  }
}

/** Valor futuro em centavos com aporte mensal e taxa anual efetiva (%), por `years` anos (mínimo 1 mês). */
export function compoundProjection(initial: number, monthly: number, annualRatePercent: number, years: number) {
  const months = Math.max(1, years * 12)
  const monthlyRate = Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1
  return Math.round(
    initial * Math.pow(1 + monthlyRate, months) +
      monthly * (monthlyRate ? (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate : months),
  )
}

/** Resultado de um ativo com cotação: valor atual, lucro/prejuízo e variação %. Null quando não há cotação. */
export function getHoldingPerformance(quantity: number, averageCostCents: number, currentPriceCents: number | null) {
  const invested = quantity * averageCostCents
  const currentValue = currentPriceCents === null ? null : quantity * currentPriceCents
  const result = currentValue === null ? null : currentValue - invested
  const resultPercentage = invested && result !== null ? (result / invested) * 100 : null
  return { invested, currentValue, result, resultPercentage }
}

type AlertTx = { type: string; amountCents: number; description: string }

/** Avisos de saúde financeira. `savingsRate` é a taxa de economia em %. */
export function getSpendingAlerts(transactions: AlertTx[], income: number, expense: number, savingsRate: number) {
  const alerts: string[] = []
  if (income === 0) alerts.push('Cadastre uma receita para acompanhar sua capacidade de pagamento.')
  if (expense > income && income > 0) alerts.push('Suas despesas acumuladas superaram as receitas.')
  if (savingsRate < 10 && income > 0) alerts.push('Sua taxa de economia está abaixo de 10%.')
  const largestExpense = [...transactions].filter(item => item.type === 'expense').sort((a, b) => b.amountCents - a.amountCents)[0]
  if (largestExpense && income && largestExpense.amountCents > income * 0.3)
    alerts.push(`O lançamento “${largestExpense.description}” representa mais de 30% das receitas.`)
  if (!alerts.length) alerts.push('Nenhum alerta crítico identificado com os dados atuais.')
  return alerts
}

type ComparisonTx = { type: string; amountCents: number; date: string; categoryName?: string }

const previousMonthOf = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number)
  return monthIndex === 1 ? `${year - 1}-12` : `${year}-${String(monthIndex - 1).padStart(2, '0')}`
}

/**
 * Despesas por categoria em `selectedMonth` (AAAA-MM) comparadas com o mês anterior.
 * No mês corrente compara só até o mesmo dia nos dois meses, para não comparar meio mês com um mês inteiro.
 * Linhas ordenadas pela maior diferença em reais, para cima ou para baixo.
 */
export function getCategoryComparison(transactions: ComparisonTx[], selectedMonth: string, currentDate: string) {
  const previousMonth = previousMonthOf(selectedMonth)
  const untilDay = selectedMonth === currentDate.slice(0, 7) ? currentDate.slice(8, 10) : null
  const totals = new Map<string, { current: number; previous: number }>()
  for (const item of transactions) {
    if (item.type !== 'expense') continue
    const month = item.date.slice(0, 7)
    if (month !== selectedMonth && month !== previousMonth) continue
    if (untilDay && item.date.slice(8, 10) > untilDay) continue
    const name = item.categoryName ?? 'Sem categoria'
    const entry = totals.get(name) ?? { current: 0, previous: 0 }
    if (month === selectedMonth) entry.current += item.amountCents
    else entry.previous += item.amountCents
    totals.set(name, entry)
  }
  const rows = [...totals].map(([name, { current, previous }]) => ({
    name,
    current,
    previous,
    difference: current - previous,
    percentage: previous ? Math.round(((current - previous) / previous) * 100) : null,
  }))
  rows.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || a.name.localeCompare(b.name, 'pt-BR'))
  return {
    previousMonth,
    untilDay: untilDay ? Number(untilDay) : null,
    rows,
    totalCurrent: rows.reduce((sum, row) => sum + row.current, 0),
    totalPrevious: rows.reduce((sum, row) => sum + row.previous, 0),
  }
}

type FixedTx = { type: string; amountCents: number; date: string; description: string; recurring?: boolean; categoryName?: string; installmentGroup?: string | null }

const descriptionKey = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Despesas que se repetem todo mês, olhando os últimos `months` meses até `currentDate`.
 * Entra quando a mesma descrição aparece em pelo menos 3 meses com valor estável (variação de até 15%),
 * ou quando foi cadastrada como recorrente e aparece em pelo menos 2 meses. O valor mensal é o mais recente.
 * Fica de fora o que não aparece nem no mês atual nem no anterior (provavelmente foi cancelado) e as parcelas, que têm fim.
 */
export function getFixedExpenses(transactions: FixedTx[], currentDate: string, months = 6) {
  const [year, month] = currentDate.slice(0, 7).split('-').map(Number)
  const firstMonth = new Date(Date.UTC(year, month - months, 1)).toISOString().slice(0, 7)
  const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
  const inWindow = transactions.filter(item => item.date <= currentDate && item.date.slice(0, 7) >= firstMonth)

  const groups = new Map<string, FixedTx[]>()
  for (const item of inWindow) {
    if (item.type !== 'expense' || item.installmentGroup) continue
    const key = descriptionKey(item.description)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  const items = [...groups.values()].flatMap(group => {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
    const monthsSeen = new Set(sorted.map(item => item.date.slice(0, 7))).size
    const amounts = sorted.map(item => item.amountCents).sort((a, b) => a - b)
    const median = amounts[Math.floor(amounts.length / 2)]
    const stable = median > 0 && (amounts.at(-1)! - amounts[0]) / median <= 0.15
    const recurring = sorted.some(item => item.recurring)
    const last = sorted.at(-1)!
    if (!((monthsSeen >= 3 && stable) || (recurring && monthsSeen >= 2)) || last.date.slice(0, 7) < previousMonth) return []
    return [{
      description: last.description,
      categoryName: last.categoryName,
      monthlyCents: last.amountCents,
      months: monthsSeen,
      lastDate: last.date,
      paidThisMonth: last.date.startsWith(currentDate.slice(0, 7)),
    }]
  }).sort((a, b) => b.monthlyCents - a.monthlyCents || a.description.localeCompare(b.description, 'pt-BR'))

  const incomeByMonth = new Map<string, number>()
  for (const item of inWindow) if (item.type === 'income') incomeByMonth.set(item.date.slice(0, 7), (incomeByMonth.get(item.date.slice(0, 7)) ?? 0) + item.amountCents)
  const averageIncome = incomeByMonth.size ? [...incomeByMonth.values()].reduce((sum, value) => sum + value, 0) / incomeByMonth.size : 0
  const totalCents = items.reduce((sum, item) => sum + item.monthlyCents, 0)
  return { items, totalCents, averageIncomeCents: Math.round(averageIncome), shareOfIncome: averageIncome ? Math.round((totalCents / averageIncome) * 100) : null }
}

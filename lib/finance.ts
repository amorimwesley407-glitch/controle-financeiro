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

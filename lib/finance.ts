import { addMonthsToDate, daysBetween } from './accounts'

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

/**
 * Orçamentos de `fromMonth` que ainda não existem em `toMonth`, já com o mês trocado.
 * Um orçamento já existe quando o mês de destino tem outro da mesma categoria (ou do mesmo nome, nos antigos sem categoria).
 */
export function getBudgetsToCopy<T extends BudgetItem>(budgets: T[], fromMonth: string, toMonth: string) {
  const keyOf = (budget: BudgetItem) => (budget.categoryId ? `categoria:${budget.categoryId}` : `nome:${normalize(budget.name)}`)
  const taken = new Set(budgets.filter(budget => budget.month === toMonth).map(keyOf))
  return budgets
    .filter(budget => budget.month === fromMonth && !taken.has(keyOf(budget)))
    .map(({ name, limitCents, categoryId }) => ({ name, limitCents, categoryId, month: toMonth }))
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

export const previousMonthOf = (month: string) => {
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

type BillTx = { type: string; date: string; billStatus?: string | null }

/** Contas a pagar ainda pendentes que já venceram ou vencem em até `withinDays` dias, da mais atrasada à mais distante. */
export function getPendingBills<T extends BillTx>(transactions: T[], currentDate: string, withinDays: number) {
  return transactions
    .filter(item => item.type === 'expense' && item.billStatus === 'pending' && daysBetween(currentDate, item.date) <= withinDays)
    .map(item => ({ ...item, daysLeft: daysBetween(currentDate, item.date) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

type WorthTx = { type: string; amountCents: number; date: string }
type WorthHolding = { quantity: string; averageCostCents: number; applicationDate?: string | null; createdAt?: Date | string | null }

const holdingDate = (holding: WorthHolding) =>
  holding.applicationDate ?? (holding.createdAt instanceof Date ? holding.createdAt.toISOString() : holding.createdAt ?? '').slice(0, 10)

/**
 * Patrimônio no fim de cada mês, até `currentDate` no mês atual: saldo inicial das contas (a dívida dos cartões entra
 * negativa), mais receitas e menos despesas até a data, mais os investimentos pelo valor aplicado.
 * Transferências só movem dinheiro entre contas e não mudam o total.
 * Começa no primeiro mês com movimento, limitado aos últimos `months` meses.
 */
export function getNetWorthHistory(accounts: { initialBalanceCents: number }[], transactions: WorthTx[], holdings: WorthHolding[], currentDate: string, months = 12) {
  const base = accounts.reduce((sum, account) => sum + account.initialBalanceCents, 0)
  const dates = [...transactions.map(item => item.date), ...holdings.map(holdingDate)].filter(Boolean).sort()
  const currentMonth = currentDate.slice(0, 7)
  const earliest = addMonthsToDate(`${currentMonth}-01`, 1 - months).slice(0, 7)
  const first = !dates.length ? currentMonth : dates[0].slice(0, 7) > earliest ? dates[0].slice(0, 7) : earliest
  const history: { month: string; valueCents: number }[] = []
  for (let month = first; month <= currentMonth; month = addMonthsToDate(`${month}-01`, 1).slice(0, 7)) {
    // Datas são texto AAAA-MM-DD: "-31" fica depois de qualquer dia do mês, mesmo nos meses mais curtos.
    const end = month === currentMonth ? currentDate : `${month}-31`
    let value = base
    for (const item of transactions) {
      if (item.date > end) continue
      if (item.type === 'income') value += item.amountCents
      else if (item.type === 'expense') value -= item.amountCents
    }
    for (const holding of holdings) {
      const date = holdingDate(holding)
      if (!date || date <= end) value += Math.round(Number(holding.quantity) * holding.averageCostCents)
    }
    history.push({ month, valueCents: value })
  }
  return history
}

const plainText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Categorias que o Imposto de Renda deixa deduzir: saúde (sem limite) e educação (com limite anual por pessoa). */
export const isDeductibleCategory = (name?: string | null) => Boolean(name && /\b(saude|educacao)\b/.test(plainText(name)))

type AnnualTx = { type: string; amountCents: number; date: string; categoryName?: string }

/** Totais de `year` (AAAA) até `currentDate`, por categoria, e as despesas dedutíveis lançamento a lançamento. */
export function getAnnualSummary<T extends AnnualTx>(transactions: T[], year: string, currentDate: string) {
  const items = transactions.filter(item => item.date.startsWith(`${year}-`) && item.date <= currentDate)
  const byCategory = (type: string) => {
    const totals = new Map<string, number>()
    for (const item of items) {
      if (item.type !== type) continue
      const name = item.categoryName ?? 'Sem categoria'
      totals.set(name, (totals.get(name) ?? 0) + item.amountCents)
    }
    return [...totals].map(([name, totalCents]) => ({ name, totalCents, deductible: type === 'expense' && isDeductibleCategory(name) })).sort((a, b) => b.totalCents - a.totalCents)
  }
  const sum = (type: string) => items.reduce((total, item) => total + (item.type === type ? item.amountCents : 0), 0)
  const deductible = items.filter(item => item.type === 'expense' && isDeductibleCategory(item.categoryName)).sort((a, b) => a.date.localeCompare(b.date))
  return {
    incomeCents: sum('income'),
    expenseCents: sum('expense'),
    incomeByCategory: byCategory('income'),
    expenseByCategory: byCategory('expense'),
    deductible,
    deductibleCents: deductible.reduce((total, item) => total + item.amountCents, 0),
  }
}

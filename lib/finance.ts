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

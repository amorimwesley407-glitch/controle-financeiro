type AccountTx = { type: string; amountCents: number; date: string; accountId?: number | null }
type AccountTransfer = { fromAccountId: number; toAccountId: number; amountCents: number; date: string }
type BalanceAccount = { id: number; initialBalanceCents: number }
type CardAccount = BalanceAccount & { closingDay: number | null; dueDay: number | null }

const lastDayOf = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

/** Soma meses a uma data AAAA-MM-DD, usando o último dia do mês quando o dia não existe (31/01 + 1 mês = 28/02). */
export function addMonthsToDate(date: string, offset: number) {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + offset, 1))
  const lastDay = lastDayOf(target.getUTCFullYear(), target.getUTCMonth())
  return `${target.toISOString().slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/** Divide um total em parcelas iguais. Os centavos que sobram ficam nas primeiras, e a soma é sempre o total. */
export function splitInstallments(totalCents: number, count: number) {
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

/** Saldo em `currentDate`. Lançamentos e transferências futuros ainda não contam. Em cartões, negativo é dívida. */
export function getAccountBalance(account: BalanceAccount, transactions: AccountTx[], transfers: AccountTransfer[], currentDate: string) {
  let balance = account.initialBalanceCents
  for (const item of transactions) {
    if (item.accountId !== account.id || item.date > currentDate) continue
    if (item.type === 'income') balance += item.amountCents
    else if (item.type === 'expense') balance -= item.amountCents
  }
  for (const item of transfers) {
    if (item.date > currentDate) continue
    if (item.toAccountId === account.id) balance += item.amountCents
    if (item.fromAccountId === account.id) balance -= item.amountCents
  }
  return balance
}

const dayInMonth = (month: string, day: number) => {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${month}-${String(Math.min(day, lastDayOf(year, monthNumber - 1))).padStart(2, '0')}`
}
const nextMonth = (month: string) => addMonthsToDate(`${month}-01`, 1).slice(0, 7)

/** Data de fechamento da fatura em que cai uma compra. Compra no dia do fechamento ainda entra nessa fatura. */
export function getInvoiceClosingDate(date: string, closingDay: number) {
  const closing = dayInMonth(date.slice(0, 7), closingDay)
  return date <= closing ? closing : dayInMonth(nextMonth(date.slice(0, 7)), closingDay)
}

/**
 * Datas das parcelas: uma por mês a partir da compra, com exatamente uma em cada fatura seguida.
 * Só ajusta a data quando o mês curto faria duas parcelas caírem na mesma fatura e nenhuma na seguinte.
 */
export function getInstallmentDates(date: string, count: number, closingDay: number) {
  let closing = getInvoiceClosingDate(date, closingDay)
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return date
    const previousClosing = closing
    closing = dayInMonth(nextMonth(previousClosing.slice(0, 7)), closingDay)
    const candidate = addMonthsToDate(date, index)
    if (candidate <= previousClosing) return new Date(Date.parse(`${previousClosing}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    return candidate > closing ? closing : candidate
  })
}

/** Vencimento da fatura. Se o dia de vencimento não vem depois do fechamento, ele cai no mês seguinte. */
export function getInvoiceDueDate(closingDate: string, closingDay: number, dueDay: number) {
  const month = closingDate.slice(0, 7)
  return dayInMonth(dueDay > closingDay ? month : nextMonth(month), dueDay)
}

export type InvoiceStatus = 'paid' | 'overdue' | 'closed' | 'open' | 'future'

/**
 * Faturas do cartão, da mais antiga para a mais recente.
 * Pagamentos são as transferências recebidas até `currentDate`: quitam primeiro a dívida inicial e depois as faturas mais antigas.
 * Estornos (receitas no cartão) reduzem a fatura em que caem.
 */
export function getCardInvoices<T extends AccountTx>(card: CardAccount, transactions: T[], transfers: AccountTransfer[], currentDate: string) {
  if (card.closingDay === null || card.dueDay === null) return []
  const { closingDay, dueDay } = card
  const groups = new Map<string, T[]>()
  for (const item of transactions) {
    if (item.accountId !== card.id || (item.type !== 'expense' && item.type !== 'income')) continue
    const closing = getInvoiceClosingDate(item.date, closingDay)
    groups.set(closing, [...(groups.get(closing) ?? []), item])
  }
  let available = card.initialBalanceCents
  for (const item of transfers) {
    if (item.date > currentDate) continue
    if (item.toAccountId === card.id) available += item.amountCents
    if (item.fromAccountId === card.id) available -= item.amountCents
  }
  const currentClosing = getInvoiceClosingDate(currentDate, closingDay)
  return [...groups.keys()].sort().map(closingDate => {
    const items = groups.get(closingDate)!
    const totalCents = items.reduce((sum, item) => sum + (item.type === 'expense' ? item.amountCents : -item.amountCents), 0)
    const paidCents = totalCents > 0 ? Math.min(totalCents, Math.max(available, 0)) : 0
    available -= totalCents
    const remainingCents = Math.max(totalCents - paidCents, 0)
    const dueDate = getInvoiceDueDate(closingDate, closingDay, dueDay)
    const status: InvoiceStatus = closingDate > currentClosing ? 'future'
      : closingDate === currentClosing ? 'open'
      : remainingCents === 0 ? 'paid'
      : dueDate < currentDate ? 'overdue' : 'closed'
    return { closingDate, dueDate, totalCents, paidCents, remainingCents, status, items }
  })
}

export const CARD_BRANDS = { visa: 'Visa', mastercard: 'Mastercard', elo: 'Elo', amex: 'American Express', hipercard: 'Hipercard' } as const
export const CARD_COLORS = {
  nubank: { label: 'Nubank', from: '#9A1FE0', to: '#5B0A99', text: '#FFFFFF', match: /^nu\s?ban/ },
  inter: { label: 'Inter', from: '#FF8A00', to: '#E85D00', text: '#FFFFFF', match: /\binter\b/ },
  itau: { label: 'Itaú', from: '#FF7A00', to: '#D85E00', text: '#FFFFFF', match: /\bitau\b/ },
  bradesco: { label: 'Bradesco', from: '#E1173F', to: '#99051F', text: '#FFFFFF', match: /\bbradesco\b/ },
  santander: { label: 'Santander', from: '#EC0000', to: '#A80000', text: '#FFFFFF', match: /\bsantander\b/ },
  bb: { label: 'Banco do Brasil', from: '#FFEF38', to: '#F5C800', text: '#003DA5', match: /\b(bb|banco do brasil)\b/ },
  caixa: { label: 'Caixa', from: '#0070C0', to: '#003F7D', text: '#FFFFFF', match: /\bcaixa\b/ },
  c6: { label: 'C6 Bank', from: '#3A3A3A', to: '#0D0D0D', text: '#FFFFFF', match: /\bc6\b/ },
  picpay: { label: 'PicPay', from: '#2BD46F', to: '#11994A', text: '#FFFFFF', match: /\bpicpay\b/ },
  mercadopago: { label: 'Mercado Pago', from: '#22BDF5', to: '#0084C7', text: '#FFFFFF', match: /\bmercado ?(pago|livre)\b/ },
  neon: { label: 'Neon', from: '#14C8F0', to: '#0A6FD8', text: '#FFFFFF', match: /\bneon\b/ },
  graphite: { label: 'Grafite', from: '#4A5568', to: '#1A202C', text: '#FFFFFF', match: /^$/ },
} as const
export type CardBrand = keyof typeof CARD_BRANDS
export type CardColor = keyof typeof CARD_COLORS

/** Cor salva no cartão ou, se não houver, a do banco reconhecido pelo nome ("Nubanck" também vale). */
export function getCardColor(color: string | null | undefined, name: string): CardColor {
  if (color && color in CARD_COLORS) return color as CardColor
  const text = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const found = (Object.keys(CARD_COLORS) as CardColor[]).find(key => CARD_COLORS[key].match.test(text))
  return found ?? 'graphite'
}

/** Metas ligadas a uma conta mostram o saldo atual dela como valor guardado, nunca abaixo de zero. */
export function applyGoalBalances<G extends { accountId?: number | null; currentCents: number }, T extends AccountTx>(goals: G[], accounts: BalanceAccount[], transactions: T[], transfers: AccountTransfer[], currentDate: string) {
  return goals.map(goal => {
    const account = accounts.find(item => item.id === goal.accountId)
    return account ? { ...goal, currentCents: Math.max(getAccountBalance(account, transactions, transfers, currentDate), 0) } : goal
  })
}

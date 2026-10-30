import { describe, expect, it } from 'vitest'
import { addMonthsToDate, getAccountBalance, getCardInvoices, getInvoiceClosingDate, getInstallmentDates, getInvoiceDueDate, splitInstallments } from './accounts'

const expense = (date: string, amountCents: number, accountId = 1) => ({ type: 'expense', amountCents, date, accountId })
const income = (date: string, amountCents: number, accountId = 1) => ({ type: 'income', amountCents, date, accountId })
const payment = (date: string, amountCents: number) => ({ fromAccountId: 2, toAccountId: 1, amountCents, date })
const card = (over = {}) => ({ id: 1, initialBalanceCents: 0, closingDay: 10, dueDay: 20, ...over })

describe('addMonthsToDate', () => {
  it('avança meses e vira o ano', () => {
    expect(addMonthsToDate('2026-11-15', 3)).toBe('2027-02-15')
  })
  it('usa o último dia quando o dia não existe', () => {
    expect(addMonthsToDate('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonthsToDate('2027-01-31', 2)).toBe('2027-03-31')
  })
})

describe('splitInstallments', () => {
  it('nunca perde centavos', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333])
    expect(splitInstallments(10000, 3).reduce((sum, value) => sum + value)).toBe(10000)
  })
  it('funciona com parcela única', () => {
    expect(splitInstallments(999, 1)).toEqual([999])
  })
})

describe('getAccountBalance', () => {
  const account = { id: 1, initialBalanceCents: 10000 }
  it('soma receitas e transferências recebidas, e subtrai despesas e enviadas', () => {
    const transfers = [payment('2026-10-02', 500), { fromAccountId: 1, toAccountId: 2, amountCents: 200, date: '2026-10-03' }]
    expect(getAccountBalance(account, [income('2026-10-01', 3000), expense('2026-10-01', 1000)], transfers, '2026-10-30')).toBe(12300)
  })
  it('ignora outras contas, lançamentos sem conta e datas futuras', () => {
    const txs = [expense('2026-10-01', 1000, 2), { type: 'expense', amountCents: 1000, date: '2026-10-01', accountId: null }, expense('2026-11-01', 1000)]
    expect(getAccountBalance(account, txs, [payment('2026-11-01', 500)], '2026-10-30')).toBe(10000)
  })
})

describe('datas da fatura', () => {
  it('compra até o fechamento entra na fatura do mês, e depois dele na seguinte', () => {
    expect(getInvoiceClosingDate('2026-10-10', 10)).toBe('2026-10-10')
    expect(getInvoiceClosingDate('2026-10-11', 10)).toBe('2026-11-10')
    expect(getInvoiceClosingDate('2026-12-20', 10)).toBe('2027-01-10')
  })
  it('ajusta o fechamento em meses curtos', () => {
    expect(getInvoiceClosingDate('2027-02-28', 31)).toBe('2027-02-28')
    expect(getInvoiceClosingDate('2027-03-01', 31)).toBe('2027-03-31')
  })
  it('vence no mesmo mês se o vencimento vem depois do fechamento, senão no seguinte', () => {
    expect(getInvoiceDueDate('2026-10-10', 10, 20)).toBe('2026-10-20')
    expect(getInvoiceDueDate('2026-10-25', 25, 5)).toBe('2026-11-05')
    expect(getInvoiceDueDate('2026-12-25', 25, 5)).toBe('2027-01-05')
  })
})

describe('getCardInvoices', () => {
  it('agrupa por fatura e classifica o status', () => {
    const txs = [expense('2026-08-05', 1000), expense('2026-09-05', 2000), expense('2026-10-05', 3000), expense('2026-10-20', 4000), expense('2026-11-20', 5000)]
    const invoices = getCardInvoices(card(), txs, [payment('2026-08-15', 1000)], '2026-10-15')
    expect(invoices.map(item => [item.closingDate, item.totalCents, item.status])).toEqual([
      ['2026-08-10', 1000, 'paid'],
      ['2026-09-10', 2000, 'overdue'],
      ['2026-10-10', 3000, 'closed'],
      ['2026-11-10', 4000, 'open'],
      ['2026-12-10', 5000, 'future'],
    ])
  })
  it('pagamento parcial quita primeiro a fatura mais antiga', () => {
    const invoices = getCardInvoices(card(), [expense('2026-08-05', 1000), expense('2026-09-05', 2000)], [payment('2026-09-15', 1500)], '2026-10-30')
    expect(invoices.map(item => [item.paidCents, item.remainingCents])).toEqual([[1000, 0], [500, 1500]])
  })
  it('dívida inicial consome o pagamento antes das faturas', () => {
    const [invoice] = getCardInvoices(card({ initialBalanceCents: -1000 }), [expense('2026-08-05', 1000)], [payment('2026-08-15', 1500)], '2026-10-30')
    expect(invoice.paidCents).toBe(500)
    expect(invoice.remainingCents).toBe(500)
  })
  it('pagamento agendado para o futuro ainda não conta', () => {
    const [invoice] = getCardInvoices(card(), [expense('2026-08-05', 1000)], [payment('2026-11-01', 1000)], '2026-10-30')
    expect(invoice.remainingCents).toBe(1000)
  })
  it('estorno reduz a fatura e o crédito de uma fatura negativa passa para a próxima', () => {
    const invoices = getCardInvoices(card(), [expense('2026-08-05', 1000), income('2026-08-06', 1500), expense('2026-09-05', 2000)], [], '2026-10-30')
    expect(invoices.map(item => [item.totalCents, item.remainingCents])).toEqual([[-500, 0], [2000, 1500]])
  })
  it('ignora lançamentos de outras contas', () => {
    expect(getCardInvoices(card(), [expense('2026-08-05', 1000, 2)], [], '2026-10-30')).toEqual([])
  })
})

describe('getInstallmentDates', () => {
  it('mantém o mesmo dia quando não há conflito com o fechamento', () => {
    expect(getInstallmentDates('2026-10-15', 3, 10)).toEqual(['2026-10-15', '2026-11-15', '2026-12-15'])
  })
  it('usa o último dia de meses curtos quando isso não muda a fatura', () => {
    expect(getInstallmentDates('2027-01-31', 3, 5)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
  })
  it.each([
    ['2027-01-31', 30], ['2027-01-31', 28], ['2027-01-30', 28], ['2027-01-29', 28], ['2026-12-31', 30], ['2027-12-31', 31],
    ['2028-01-31', 29], ['2026-10-15', 10], ['2027-01-31', 5], ['2027-02-28', 28], ['2026-11-30', 31], ['2027-01-01', 1],
  ])('compra em %s com fechamento no dia %i: uma parcela por fatura, sem pular nenhuma', (date, closingDay) => {
    const dates = getInstallmentDates(date as string, 48, closingDay as number)
    expect(dates[0]).toBe(date)
    const closings = dates.map(item => getInvoiceClosingDate(item, closingDay as number))
    expect(new Set(closings).size).toBe(48)
    closings.slice(1).forEach((closing, index) => {
      expect(closing.slice(0, 7)).toBe(addMonthsToDate(`${closings[index].slice(0, 7)}-01`, 1).slice(0, 7))
    })
  })
})

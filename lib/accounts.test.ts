import { describe, expect, it } from 'vitest'
import { addMonthsToDate, applyGoalBalances, daysBetween, getAccountBalance, getCardColor, getCardDueAlerts, getCardInvoices, getCardLimitUsed, getCurrentInvoice, getInvoiceClosingDate, getInstallmentAmounts, getInstallmentDates, getInvoiceDueDate, getPurchaseDueDate, splitInstallments } from './accounts'

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

describe('getInstallmentAmounts', () => {
  it('com o total da compra, divide pelo total de parcelas e lança só as que faltam', () => {
    expect(getInstallmentAmounts(100000, 10, 4, false)).toEqual(Array(7).fill(10000))
    expect(getInstallmentAmounts(10000, 3, 1, false)).toEqual([3334, 3333, 3333])
    expect(getInstallmentAmounts(10000, 3, 2, false)).toEqual([3333, 3333])
  })
  it('com o valor de cada parcela, repete o valor nas que faltam', () => {
    expect(getInstallmentAmounts(15000, 10, 4, true)).toEqual(Array(7).fill(15000))
    expect(getInstallmentAmounts(15000, 10, 10, true)).toEqual([15000])
  })
})

describe('daysBetween', () => {
  it('conta os dias, inclusive virando o mês e para trás', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
    expect(daysBetween('2026-11-02', '2026-11-02')).toBe(0)
    expect(daysBetween('2026-11-02', '2026-10-30')).toBe(-3)
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

describe('fatura atual, avisos e limite', () => {
  const txs = [expense('2026-09-05', 2000), expense('2026-10-05', 3000), expense('2026-10-20', 4000), expense('2026-11-20', 5000)]
  it('vencimento da compra segue a fatura em que ela cai', () => {
    expect(getPurchaseDueDate('2026-10-10', 10, 20)).toBe('2026-10-20')
    expect(getPurchaseDueDate('2026-10-11', 10, 20)).toBe('2026-11-20')
    expect(getPurchaseDueDate('2026-10-26', 25, 5)).toBe('2026-12-05')
  })
  it('a fatura atual é a mais antiga fechada sem pagamento, ou então a aberta', () => {
    const invoices = getCardInvoices(card(), txs, [], '2026-10-15')
    expect(getCurrentInvoice(invoices)?.closingDate).toBe('2026-09-10')
    const paid = getCardInvoices(card(), txs, [payment('2026-10-12', 5000)], '2026-10-15')
    expect(getCurrentInvoice(paid)?.closingDate).toBe('2026-11-10')
    expect(getCurrentInvoice(getCardInvoices(card(), [expense('2026-12-20', 100)], [], '2026-10-15'))).toBeUndefined()
  })
  it('avisa das faturas vencidas e das que vencem em até 3 dias, mas não das pagas', () => {
    const alerts = (date: string, transfers = [] as ReturnType<typeof payment>[]) =>
      getCardDueAlerts([card()], txs, transfers, date).map(item => [item.dueDate, item.remainingCents, item.daysLeft])
    expect(alerts('2026-10-16')).toEqual([['2026-09-20', 2000, -26]])
    expect(alerts('2026-10-17')).toEqual([['2026-09-20', 2000, -27], ['2026-10-20', 3000, 3]])
    expect(alerts('2026-10-17', [payment('2026-10-17', 5000)])).toEqual([])
  })
  it('o limite usado conta as parcelas futuras e só os pagamentos já feitos', () => {
    expect(getCardLimitUsed(card(), txs, [], '2026-10-15')).toBe(14000)
    expect(getCardLimitUsed(card({ initialBalanceCents: -1000 }), [...txs, income('2026-10-06', 500)], [payment('2026-10-12', 5000), payment('2026-12-01', 9000)], '2026-10-15')).toBe(9500)
    expect(getCardLimitUsed(card(), [expense('2026-10-05', 100, 2)], [payment('2026-10-12', 5000)], '2026-10-15')).toBe(0)
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

describe('getCardColor', () => {
  it.each([['Nubank', 'nubank'], ['Nubanck', 'nubank'], ['nu bank', 'nubank'], ['Itaú Click', 'itau'], ['Cartão BB', 'bb'], ['C6', 'c6'], ['Mercado Livre', 'mercadopago'], ['Internacional', 'graphite'], ['Meu cartão', 'graphite'], ['', 'graphite']])('%s → %s', (name, color) => {
    expect(getCardColor(null, name)).toBe(color)
  })
  it('a cor escolhida vale mais que o nome, e cor desconhecida é ignorada', () => {
    expect(getCardColor('c6', 'Nubank')).toBe('c6')
    expect(getCardColor('roxo', 'Nubank')).toBe('nubank')
  })
})

describe('applyGoalBalances', () => {
  const accounts = [{ id: 1, initialBalanceCents: 10000 }, { id: 2, initialBalanceCents: -500 }]
  it('usa o saldo da conta, nunca abaixo de zero, e mantém as metas sem conta', () => {
    const goals = [{ currentCents: 7, accountId: 1 }, { currentCents: 7, accountId: 2 }, { currentCents: 7, accountId: null }, { currentCents: 7, accountId: 99 }]
    const result = applyGoalBalances(goals, accounts, [expense('2026-10-01', 2000)], [payment('2026-10-02', 300)], '2026-10-30')
    expect(result.map(goal => goal.currentCents)).toEqual([8300, 0, 7, 7])
  })
})

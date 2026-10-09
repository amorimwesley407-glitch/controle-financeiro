import { describe, expect, it } from 'vitest'
import { parseMoneyToCents } from './money'

describe('parseMoneyToCents', () => {
  it('aceita vírgula e ponto como separador decimal', () => {
    expect(parseMoneyToCents('12,34')).toBe(1234)
    expect(parseMoneyToCents('12.34')).toBe(1234)
  })
  it('arredonda sem erro de ponto flutuante', () => {
    expect(parseMoneyToCents('1.005')).toBe(101)
    expect(parseMoneyToCents('0.1')).toBe(10)
    expect(parseMoneyToCents('19.99')).toBe(1999)
  })
  it('ignora espaços e trata vazio como zero (meta sem valor atual)', () => {
    expect(parseMoneyToCents('  50 ')).toBe(5000)
    expect(parseMoneyToCents('')).toBe(0)
    expect(parseMoneyToCents(null)).toBe(0)
  })
  it('retorna NaN para texto inválido', () => {
    expect(parseMoneyToCents('abc')).toBeNaN()
    expect(parseMoneyToCents('1,2,3')).toBeNaN()
    expect(parseMoneyToCents('Infinity')).toBeNaN()
  })
})

/** Converte texto em reais ("12,34" ou "12.34") para centavos inteiros. Retorna NaN se inválido.
 * O toPrecision elimina o ruído de ponto flutuante (1.005 * 100 = 100.49999…) antes de arredondar. */
export function parseMoneyToCents(value: unknown) {
  const text = String(value ?? '').trim().replace(',', '.')
  const number = Number(text)
  return Number.isFinite(number) ? Math.round(Number((number * 100).toPrecision(15))) : Number.NaN
}

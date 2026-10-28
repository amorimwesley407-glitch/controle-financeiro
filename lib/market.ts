import { z } from 'zod'

export type MarketQuote = { symbol: string; name: string; value: number; change: number; kind: string }
export type StockQuote = { symbol: string; name: string; logoUrl: string; price: number; change: number; updatedAt: string | null }
export type MarketData = { quotes: MarketQuote[]; stockQuotes: StockQuote[] }

// APIs externas não podem segurar a resposta: acima disso usamos o último valor bom.
const TIMEOUT_MS = 2500

// Último resultado válido de cada fonte, para quando a API falhar (as falhas não entram no cache do fetch).
const lastGood = new Map<string, unknown>()
async function withLastGood<T>(key: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const value = await load()
    lastGood.set(key, value)
    return value
  } catch {
    return (lastGood.get(key) as T | undefined) ?? fallback
  }
}

const request = (url: string, revalidate: number, headers: HeadersInit = {}) =>
  fetch(url, { headers, next: { revalidate }, signal: AbortSignal.timeout(TIMEOUT_MS) }).then(async response => {
    if (!response.ok) throw new Error(`Cotação indisponível (${response.status})`)
    return response.json()
  })

const currencyFallback: MarketQuote[] = [
  { symbol: 'USD', name: 'Dólar comercial', value: 5.47, change: 0.18, kind: 'currency' },
  { symbol: 'BTC', name: 'Bitcoin', value: 675420, change: 1.24, kind: 'crypto' },
  { symbol: 'EUR', name: 'Euro', value: 6.38, change: -0.11, kind: 'currency' },
]
const fxSchema = z.object({
  USDBRL: z.object({ bid: z.coerce.number().finite().positive(), pctChange: z.coerce.number().finite() }),
  EURBRL: z.object({ bid: z.coerce.number().finite().positive(), pctChange: z.coerce.number().finite() }),
})
const btcSchema = z.object({ bitcoin: z.object({ brl: z.number().finite().positive(), brl_24h_change: z.number().finite() }) })

function getCurrencyQuotes() {
  return withLastGood('currencies', async () => {
    const [fx, btc] = await Promise.all([
      request('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL', 900).then(data => fxSchema.parse(data)),
      request('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true', 300).then(data => btcSchema.parse(data)),
    ])
    return [
      { symbol: 'USD', name: 'Dólar comercial', value: fx.USDBRL.bid, change: fx.USDBRL.pctChange, kind: 'currency' },
      { symbol: 'BTC', name: 'Bitcoin', value: btc.bitcoin.brl, change: btc.bitcoin.brl_24h_change, kind: 'crypto' },
      { symbol: 'EUR', name: 'Euro', value: fx.EURBRL.bid, change: fx.EURBRL.pctChange, kind: 'currency' },
    ]
  }, currencyFallback)
}

const quoteSchema = z.object({
  results: z.array(z.object({
    symbol: z.string(),
    shortName: z.string().optional(),
    longName: z.string().optional(),
    logourl: z.string().url().optional(),
    regularMarketPrice: z.number().finite(),
    regularMarketChangePercent: z.number().finite().catch(0),
    regularMarketTime: z.string().optional(),
  })),
})

function getStockQuotes() {
  const token = process.env.BRAPI_TOKEN
  // Sem token a brapi só libera alguns ativos gratuitos.
  const symbols = token
    ? ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'BBDC4', 'ABEV3', 'WEGE3', 'B3SA3', 'ELET3', 'RENT3']
    : ['PETR4', 'VALE3', 'ITUB4', 'MGLU3']
  return withLastGood('stocks', async () => {
    const data = quoteSchema.parse(
      await request(`https://brapi.dev/api/quote/${symbols.join(',')}`, 300, token ? { Authorization: `Bearer ${token}` } : {}),
    )
    return data.results.map(item => ({
      symbol: item.symbol,
      name: item.shortName || item.longName || item.symbol,
      logoUrl: item.logourl ?? `https://icons.brapi.dev/icons/${item.symbol}.svg`,
      price: item.regularMarketPrice,
      change: item.regularMarketChangePercent,
      updatedAt: item.regularMarketTime ?? null,
    }))
  }, [] as StockQuote[])
}

const selicSchema = z.array(z.object({ data: z.string(), valor: z.coerce.number().finite().nonnegative() }))

function getSelic() {
  return withLastGood('selic', async () => {
    const latest = selicSchema.parse(await request('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json', 3600)).at(-1)
    if (!latest) throw new Error('Selic indisponível')
    return { symbol: 'SELIC', name: 'Meta Selic', value: latest.valor, change: 0, kind: 'rate' } as MarketQuote
  }, null)
}

export async function getMarketData(): Promise<MarketData> {
  const [currencies, stockQuotes, selic] = await Promise.all([getCurrencyQuotes(), getStockQuotes(), getSelic()])
  return { quotes: selic ? [...currencies, selic] : currencies, stockQuotes }
}

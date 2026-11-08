import { z } from 'zod'

/** `stale`: a fonte falhou e o valor é o último que deu certo. */
export type MarketQuote = { symbol: string; name: string; value: number; change: number; kind: string; stale?: boolean }
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

const awesomeSchema = z.record(z.string(), z.object({ bid: z.coerce.number().finite().positive(), pctChange: z.coerce.number().finite() }))
const btcSchema = z.object({ bitcoin: z.object({ brl: z.number().finite().positive(), brl_24h_change: z.number().finite() }) })
const currencies = [
  { symbol: 'USD', name: 'Dólar comercial', key: 'USDBRL', kind: 'currency' },
  { symbol: 'BTC', name: 'Bitcoin', key: 'BTCBRL', kind: 'crypto' },
  { symbol: 'EUR', name: 'Euro', key: 'EURBRL', kind: 'currency' },
] as const

/** Bitcoin pela CoinGecko: só reserva, porque o plano gratuito costuma recusar pedidos de servidores na nuvem. */
const coingeckoBitcoin = () =>
  request('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true', 300)
    .then(data => btcSchema.parse(data))
    .then(data => ({ value: data.bitcoin.brl, change: data.bitcoin.brl_24h_change }))

/**
 * Dólar, euro e bitcoin numa busca só na AwesomeAPI. Cada moeda é independente: a que falhar usa o último valor bom,
 * marcado como desatualizado, e some se nunca houve um. Nada de valor inventado na tela.
 */
async function getCurrencyQuotes() {
  const awesome = await request('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL', 300)
    .then(data => awesomeSchema.parse(data))
    .catch(() => ({} as z.infer<typeof awesomeSchema>))
  const quotes = await Promise.all(currencies.map(async ({ key, ...currency }) => {
    const live = awesome[key]
    const fresh = live ? { value: live.bid, change: live.pctChange } : currency.symbol === 'BTC' ? await coingeckoBitcoin().catch(() => null) : null
    const cacheKey = `quote:${currency.symbol}`
    if (fresh) {
      const quote: MarketQuote = { ...currency, ...fresh }
      lastGood.set(cacheKey, quote)
      return quote
    }
    const previous = lastGood.get(cacheKey) as MarketQuote | undefined
    return previous ? { ...previous, stale: true } : null
  }))
  return quotes.filter((quote): quote is MarketQuote => quote !== null)
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

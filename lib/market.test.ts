import { afterEach, describe, expect, it, vi } from 'vitest'

const responses: Record<string, unknown> = {
  'economia.awesomeapi.com.br': { USDBRL: { bid: '5.10', pctChange: '0.5' }, EURBRL: { bid: '6.00', pctChange: '-0.2' }, BTCBRL: { bid: '427932', pctChange: '1.0' } },
  'api.coingecko.com': { bitcoin: { brl: 500000, brl_24h_change: 2 } },
  'brapi.dev': { results: [{ symbol: 'PETR4', shortName: 'Petrobras', regularMarketPrice: 38.5, regularMarketChangePercent: 1.2 }] },
  'api.bcb.gov.br': [{ data: '01/10/2026', valor: '15.00' }],
}
const online = (url: string) => Promise.resolve(new Response(JSON.stringify(responses[new URL(url).hostname])))
const offline = () => Promise.reject(new Error('timeout'))

async function loadMarket() {
  vi.resetModules() // zera o "último valor bom" guardado no módulo
  return import('./market')
}

afterEach(() => vi.unstubAllGlobals())

describe('getMarketData', () => {
  it('monta cotações, ações e Selic quando as APIs respondem', async () => {
    vi.stubGlobal('fetch', vi.fn(online))
    const { getMarketData } = await loadMarket()
    const data = await getMarketData()
    expect(data.quotes.map(q => [q.symbol, q.value])).toEqual([['USD', 5.1], ['BTC', 427932], ['EUR', 6], ['SELIC', 15]])
    expect(data.quotes.some(q => q.stale)).toBe(false)
    expect(data.stockQuotes[0]).toMatchObject({ symbol: 'PETR4', price: 38.5, logoUrl: 'https://icons.brapi.dev/icons/PETR4.svg' })
  })

  it('sem nenhum dado anterior, não inventa cotação: omite o que falhou', async () => {
    vi.stubGlobal('fetch', vi.fn(offline))
    const { getMarketData } = await loadMarket()
    const data = await getMarketData()
    expect(data.quotes).toEqual([])
    expect(data.stockQuotes).toEqual([])
  })

  it('bitcoin vem da CoinGecko quando a AwesomeAPI falha, e as moedas sem reserva somem', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.includes('awesomeapi') ? offline() : online(url))))
    const { getMarketData } = await loadMarket()
    const data = await getMarketData()
    expect(data.quotes.map(q => [q.symbol, q.value])).toEqual([['BTC', 500000], ['SELIC', 15]])
  })

  it('quando a API cai, devolve o último valor bom marcado como desatualizado', async () => {
    const fetchMock = vi.fn(online)
    vi.stubGlobal('fetch', fetchMock)
    const { getMarketData } = await loadMarket()
    const first = await getMarketData()
    fetchMock.mockImplementation(offline)
    const second = await getMarketData()
    expect(second.quotes.map(q => [q.symbol, q.value, q.stale ?? false])).toEqual(first.quotes.map(q => [q.symbol, q.value, q.kind !== 'rate']))
  })

  it('só a fonte que falhou usa o valor anterior', async () => {
    const fetchMock = vi.fn(online)
    vi.stubGlobal('fetch', fetchMock)
    const { getMarketData } = await loadMarket()
    await getMarketData()
    responses['brapi.dev'] = { results: [{ symbol: 'VALE3', regularMarketPrice: 60, regularMarketChangePercent: 0 }] }
    fetchMock.mockImplementation(url => (url.includes('bcb.gov.br') ? offline() : online(url)))
    const data = await getMarketData()
    expect(data.stockQuotes[0].symbol).toBe('VALE3')
    expect(data.quotes.at(-1)).toMatchObject({ symbol: 'SELIC', value: 15 })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

const responses: Record<string, unknown> = {
  'economia.awesomeapi.com.br': { USDBRL: { bid: '5.10', pctChange: '0.5' }, EURBRL: { bid: '6.00', pctChange: '-0.2' } },
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
    expect(data.quotes.map(q => [q.symbol, q.value])).toEqual([['USD', 5.1], ['BTC', 500000], ['EUR', 6], ['SELIC', 15]])
    expect(data.stockQuotes[0]).toMatchObject({ symbol: 'PETR4', price: 38.5, logoUrl: 'https://icons.brapi.dev/icons/PETR4.svg' })
  })

  it('sem nenhum dado anterior, usa a reserva fixa e omite Selic e ações', async () => {
    vi.stubGlobal('fetch', vi.fn(offline))
    const { getMarketData } = await loadMarket()
    const data = await getMarketData()
    expect(data.quotes.map(q => q.symbol)).toEqual(['USD', 'BTC', 'EUR'])
    expect(data.stockQuotes).toEqual([])
  })

  it('quando a API cai, devolve o último valor bom em vez da reserva', async () => {
    const fetchMock = vi.fn(online)
    vi.stubGlobal('fetch', fetchMock)
    const { getMarketData } = await loadMarket()
    const first = await getMarketData()
    fetchMock.mockImplementation(offline)
    expect(await getMarketData()).toEqual(first)
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

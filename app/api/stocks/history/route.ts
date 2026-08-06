import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'

const allowedRanges = ['7d', '1mo', '6mo', '1y'] as const
const pointSchema = z.object({
  date: z.number(),
  close: z.number().nullable(),
  adjustedClose: z.number().nullable().optional(),
})

async function getYahooHistory(symbol: string, range: typeof allowedRanges[number]) {
  try {
    const rangeDays = { '7d': 7, '1mo': 31, '6mo': 183, '1y': 366 }[range]
    const period2 = Math.floor(Date.now() / 1000)
    const period1 = period2 - rangeDays * 24 * 60 * 60
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.SA?period1=${period1}&period2=${period2}&interval=1d`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(7000),
    })
    if (!response.ok) return []
    const payload = await response.json()
    const result = payload?.chart?.result?.[0]
    const timestamps: unknown[] = Array.isArray(result?.timestamp) ? result.timestamp : []
    const closes: unknown[] = Array.isArray(result?.indicators?.adjclose?.[0]?.adjclose)
      ? result.indicators.adjclose[0].adjclose
      : Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
    return timestamps.flatMap((date, index) =>
      typeof date === 'number' && typeof closes[index] === 'number'
        ? [{ date, value: closes[index] as number }]
        : [],
    )
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const range = z.enum(allowedRanges).catch('1mo').parse(request.nextUrl.searchParams.get('range'))
  const symbols = (request.nextUrl.searchParams.get('symbols') ?? '')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9]{4,8}$/.test(symbol))
    .slice(0, 10)
  if (!symbols.length) return NextResponse.json({ histories: {} })

  const token = process.env.BRAPI_TOKEN
  const entries = await Promise.all(symbols.map(async (symbol) => {
    try {
      const response = await fetch(`https://brapi.dev/api/quote/${symbol}?range=${range}&interval=1d`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(7000),
      })
      if (!response.ok) return [symbol, await getYahooHistory(symbol, range)] as const
      const payload = await response.json()
      const result = payload?.results?.[0]
      const rawPoints = result?.historicalDataPrice ?? result?.data?.historicalDataPrice ?? []
      const points = z.array(pointSchema).catch([]).parse(rawPoints)
        .filter((point) => point.close !== null)
        .map((point) => ({ date: point.date, value: point.adjustedClose ?? point.close as number }))
      return [symbol, points.length > 1 ? points : await getYahooHistory(symbol, range)] as const
    } catch {
      return [symbol, await getYahooHistory(symbol, range)] as const
    }
  }))

  return NextResponse.json({ histories: Object.fromEntries(entries) })
}

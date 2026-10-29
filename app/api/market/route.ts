import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getMarketData } from '@/lib/market'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  return NextResponse.json(await getMarketData())
}

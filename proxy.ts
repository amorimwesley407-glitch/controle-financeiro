import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

// Checagem otimista (só a presença do cookie): sem ela, o app/loading.tsx começaria a
// transmitir a página e o redirecionamento para o login viraria um redirect no navegador.
// A validação real da sessão continua em app/page.tsx.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL('/sign-in', request.url))
  return NextResponse.next()
}

export const config = { matcher: '/' }

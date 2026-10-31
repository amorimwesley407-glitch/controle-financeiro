import { readdir, readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Teste de integração com o Better Auth de verdade. Só roda com TEST_DATABASE_URL; o banco é APAGADO e recriado.
const email = vi.hoisted(() => {
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.BETTER_AUTH_SECRET ??= 'segredo-de-teste-com-mais-de-32-caracteres'
    delete process.env.BETTER_AUTH_URL
  }
  return { send: vi.fn<(to: string, url: string) => Promise<void>>(async () => {}) }
})
vi.mock('./email', () => ({ sendPasswordResetEmail: email.send }))

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const origin = 'http://localhost:3000'
const oldPassword = 'senha-antiga-123'
const newPassword = 'senha-nova-456789'

describe.skipIf(!testDatabaseUrl)('recuperação de senha', () => {
  const sql = postgres(testDatabaseUrl ?? 'postgres://unused', { max: 1, onnotice: () => {} })
  let auth: typeof import('./auth')['auth']
  const call = (path: string, body: object, cookie = '') => auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }))
  const requestLink = async () => {
    await call('/request-password-reset', { email: 'eva@teste.local', redirectTo: '/reset-password' })
    return email.send.mock.lastCall![1]
  }
  /** Abre o link do e-mail como o navegador faria e devolve o destino do redirecionamento. */
  const openLink = async (url: string) => {
    const response = await auth.handler(new Request(url.replace(/^https?:\/\/[^/]+/, origin), { headers: { origin } }))
    return new URL(response.headers.get('location')!, origin)
  }

  beforeAll(async () => {
    await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
    const dir = new URL('./db/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) await sql.unsafe(await readFile(new URL(file, dir), 'utf8'))
    auth = (await import('./auth')).auth
  })
  afterAll(async () => {
    await sql.end()
    const { client } = await import('./db')
    await client.end()
  })
  beforeEach(async () => {
    email.send.mockClear()
    await sql`TRUNCATE "user", "verification", "rateLimit" CASCADE`
    expect((await call('/sign-up/email', { name: 'Eva', email: 'eva@teste.local', password: oldPassword })).status).toBe(200)
  })

  it('e-mail sem conta recebe a mesma resposta e nenhum envio', async () => {
    const response = await call('/request-password-reset', { email: 'ninguem@teste.local', redirectTo: '/reset-password' })
    expect(response.status).toBe(200)
    expect(email.send).not.toHaveBeenCalled()
  })

  it('troca a senha pelo link, derruba as sessões e o link não vale de novo', async () => {
    const signIn = await call('/sign-in/email', { email: 'eva@teste.local', password: oldPassword })
    const cookie = signIn.headers.getSetCookie().map(item => item.split(';')[0]).join('; ')
    const destination = await openLink(await requestLink())
    expect(destination.pathname).toBe('/reset-password')
    const token = destination.searchParams.get('token')!

    expect((await call('/reset-password', { newPassword, token })).status).toBe(200)
    expect((await call('/sign-in/email', { email: 'eva@teste.local', password: oldPassword })).status).toBe(401)
    expect((await call('/sign-in/email', { email: 'eva@teste.local', password: newPassword })).status).toBe(200)

    const session = await auth.handler(new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }))
    expect(await session.json()).toBeNull()
    expect((await call('/reset-password', { newPassword: 'outra-senha-1234567', token })).status).toBe(400)
  })

  it('recusa token inválido e senha curta', async () => {
    expect((await call('/reset-password', { newPassword, token: 'inventado' })).status).toBe(400)
    const token = (await openLink(await requestLink())).searchParams.get('token')!
    expect((await call('/reset-password', { newPassword: 'curta', token })).status).toBe(400)
  })

  it('limita pedidos repetidos', async () => {
    const statuses = []
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await auth.handler(new Request(`${origin}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': '203.0.113.9' },
        body: JSON.stringify({ email: 'eva@teste.local', redirectTo: '/reset-password' }),
      }))
      statuses.push(response.status)
    }
    expect(statuses).toEqual([200, 200, 200, 429])
  })
})

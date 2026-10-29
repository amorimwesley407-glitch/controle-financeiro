import { readdir, readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Teste de integração com o Better Auth de verdade. Só roda com TEST_DATABASE_URL; o banco é APAGADO e recriado.
const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl
  process.env.BETTER_AUTH_SECRET ??= 'segredo-de-teste-com-mais-de-32-caracteres'
  delete process.env.BETTER_AUTH_URL
}

const origin = 'http://localhost:3000'
const call = (auth: { handler: (request: Request) => Promise<Response> }, path: string, body: object, cookie = '') =>
  auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }))

describe.skipIf(!testDatabaseUrl)('foto de perfil pela API de login', () => {
  const sql = postgres(testDatabaseUrl ?? 'postgres://unused', { max: 1, onnotice: () => {} })
  let auth: typeof import('./auth')['auth']
  const victimImage = 'supabase-storage://finance-uploads/vitima/transaction-images/0f8b2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg'

  beforeAll(async () => {
    await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
    const dir = new URL('./db/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
      await sql.unsafe(await readFile(new URL(file, dir), 'utf8'))
    }
    auth = (await import('./auth')).auth
  })

  afterAll(async () => {
    await sql.end()
    const { client } = await import('./db')
    await client.end()
  })

  it('não deixa criar conta já com uma imagem qualquer', async () => {
    const response = await call(auth, '/sign-up/email', { name: 'Mallory', email: 'mallory@teste.local', password: 'senha-forte-123', image: victimImage })
    expect(response.status).toBe(403)
    expect(await sql`SELECT 1 FROM "user" WHERE "email" = 'mallory@teste.local'`).toHaveLength(0)
  })

  it('não deixa trocar a imagem pelo /update-user, mas o resto continua funcionando', async () => {
    const signUp = await call(auth, '/sign-up/email', { name: 'Eva', email: 'eva@teste.local', password: 'senha-forte-123' })
    expect(signUp.status).toBe(200)
    const cookie = signUp.headers.getSetCookie().map(item => item.split(';')[0]).join('; ')

    expect((await call(auth, '/update-user', { image: victimImage }, cookie)).status).toBe(403)
    expect((await call(auth, '/update-user', { name: 'Eva Silva', image: victimImage }, cookie)).status).toBe(403)
    expect((await call(auth, '/update-user', { name: 'Eva Silva' }, cookie)).status).toBe(200)

    const [user] = await sql`SELECT "name", "image" FROM "user" WHERE "email" = 'eva@teste.local'`
    expect(user).toEqual({ name: 'Eva Silva', image: null })
  })
})

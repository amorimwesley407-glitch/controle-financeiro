import { readdir, readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { base32 } from '@better-auth/utils/base32'
import { createOTP } from '@better-auth/utils/otp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Teste de integração com o Better Auth de verdade: confere que a migração 0006 bate com o plugin twoFactor
// e que, com a verificação ligada, a senha sozinha não abre sessão.
// Só roda com TEST_DATABASE_URL definida. O banco é APAGADO e recriado a cada execução.
vi.hoisted(() => {
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  process.env.BETTER_AUTH_SECRET ??= 'segredo-so-para-testes-com-mais-de-32-caracteres'
})
vi.mock('@/lib/storage', () => ({ uploadImage: async () => null, removeImage: async () => {}, signImageUrls: async (value: unknown) => value }))
vi.mock('@/lib/email', () => ({ sendPasswordResetEmail: async () => {} }))

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const cookiesFrom = (response: Response) => response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
/** Código que o app autenticador mostraria agora, a partir da chave do QR code. */
const codeFrom = async (totpURI: string) =>
  createOTP(new TextDecoder().decode(base32.decode(new URL(totpURI).searchParams.get('secret')!))).totp()

describe.skipIf(!testDatabaseUrl)('verificação em duas etapas', () => {
  const sql = postgres(testDatabaseUrl ?? 'postgres://unused', { max: 1, onnotice: () => {} })
  let auth: typeof import('./auth').auth

  beforeAll(async () => {
    await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
    const dir = new URL('./db/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
      await sql.unsafe(await readFile(new URL(file, dir), 'utf8'))
    }
    ;({ auth } = await import('./auth'))
  })

  afterAll(async () => {
    await sql.end()
    const { client } = await import('@/lib/db')
    await client.end()
  })

  it('só liga depois do código do app e, ligada, a senha sozinha não abre sessão', async () => {
    const email = 'duas.etapas@teste.local'
    const password = 'SenhaForte123!'
    const enabledFlag = async () => (await sql`SELECT "twoFactorEnabled" FROM "user" WHERE "email" = ${email}`)[0].twoFactorEnabled
    const signUp = await auth.api.signUpEmail({ body: { name: 'Duas Etapas', email, password }, asResponse: true })
    const session = new Headers({ cookie: cookiesFrom(signUp) })

    await expect(auth.api.enableTwoFactor({ body: { password: 'senha-errada-123' }, headers: session })).rejects.toThrow()
    const setup = await auth.api.enableTwoFactor({ body: { password }, headers: session })
    if (setup.method !== 'totp') throw new Error('esperava TOTP')
    expect(setup.backupCodes).toHaveLength(10)
    expect(await enabledFlag()).toBe(false)
    await expect(auth.api.verifyTOTP({ body: { code: '000000' }, headers: session })).rejects.toThrow()
    await auth.api.verifyTOTP({ body: { code: await codeFrom(setup.totpURI) }, headers: session })
    expect(await enabledFlag()).toBe(true)

    // Login com a senha certa: pede o código e não cria sessão.
    const signIn = await auth.api.signInEmail({ body: { email, password }, asResponse: true })
    expect(await signIn.json()).toMatchObject({ twoFactorRedirect: true })
    const pending = new Headers({ cookie: cookiesFrom(signIn) })
    expect(await auth.api.getSession({ headers: pending })).toBeNull()

    // Código de recuperação abre a sessão uma única vez.
    const [backupCode] = setup.backupCodes
    const verified = await auth.api.verifyBackupCode({ body: { code: backupCode }, headers: pending, asResponse: true })
    expect(verified.ok).toBe(true)
    const opened = await auth.api.getSession({ headers: new Headers({ cookie: cookiesFrom(verified) }) })
    expect(opened?.user.email).toBe(email)
    const again = await auth.api.signInEmail({ body: { email, password }, asResponse: true })
    const reused = await auth.api.verifyBackupCode({ body: { code: backupCode }, headers: new Headers({ cookie: cookiesFrom(again) }), asResponse: true })
    expect(reused.ok).toBe(false)

    // Desligar pede a senha e volta a abrir sessão só com ela.
    await auth.api.disableTwoFactor({ body: { password }, headers: new Headers({ cookie: cookiesFrom(verified) }) })
    expect(await enabledFlag()).toBe(false)
    const plain = await auth.api.signInEmail({ body: { email, password }, asResponse: true })
    expect(await plain.json()).not.toHaveProperty('twoFactorRedirect')
  })
})

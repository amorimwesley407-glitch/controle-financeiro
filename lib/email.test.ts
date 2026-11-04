import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmail, sendPasswordResetEmail } from './email'

describe('envio de e-mail', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('sem configuração, falha sem chamar a API', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendEmail({ to: 'a@b.c', subject: 's', html: 'h', text: 't' })).rejects.toThrow('RESEND_API_KEY')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia o link e o erro da API não expõe o link', async () => {
    vi.stubEnv('RESEND_API_KEY', 'chave')
    vi.stubEnv('EMAIL_FROM', 'Clareza <a@b.c>')
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const link = 'https://app.test/api/auth/reset-password/tok?callbackURL=%2Freset-password&x=1'
    await sendPasswordResetEmail('a@b.c', link)
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body.to).toBe('a@b.c')
    expect(body.text).toContain(link)
    expect(body.html).toContain('&amp;x=1')

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    const error = await sendPasswordResetEmail('a@b.c', link).catch(failure => failure as Error)
    expect((error as Error).message).toBe('Falha ao enviar e-mail: 500')
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { betterAuth } from 'better-auth'
import { blockGenericAuthImageInput } from '@/lib/auth-image-policy'

const auth = betterAuth({
  secret: 'test-secret-with-at-least-32-characters',
  baseURL: 'http://localhost:3000',
  rateLimit: { enabled: false },
  emailAndPassword: { enabled: true },
  hooks: { before: blockGenericAuthImageInput },
})

for (const path of ['/api/auth/update-user', '/api/auth/sign-up/email']) {
  test(`${path} rejeita explicitamente o campo image`, async () => {
    const response = await auth.handler(new Request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ image: 'supabase-storage://finance-uploads/A/profile-images/123e4567-e89b-12d3-a456-426614174000.jpg' }),
    }))
    assert.equal(response.status, 403)
    const payload = await response.json() as { message?: string }
    assert.match(payload.message ?? '', /fluxo protegido de perfil/)
  })

  test(`${path} também rejeita image nulo`, async () => {
    const response = await auth.handler(new Request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ image: null }),
    }))
    assert.equal(response.status, 403)
  })
}

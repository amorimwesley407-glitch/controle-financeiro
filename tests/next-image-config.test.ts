import assert from 'node:assert/strict'
import test from 'node:test'
async function loadConfig(environment: Record<string, string>) {
  const previous = { ...process.env }
  Object.assign(process.env, environment)
  try {
    return (await import(`../next.config.mjs?test=${crypto.randomUUID()}`)).default
  } finally {
    process.env = previous
  }
}

test('configuração local permite HTTP e scripts de desenvolvimento', async () => {
  const config = await loadConfig({ NODE_ENV: 'development', BETTER_AUTH_URL: 'http://localhost:3000', NEXT_PUBLIC_SUPABASE_URL: '' })
  const headers = (await config.headers())[0].headers
  const csp = headers.find((header: { key: string }) => header.key === 'Content-Security-Policy').value
  assert.equal(csp.includes('upgrade-insecure-requests'), false)
  assert.ok(csp.includes("'unsafe-eval'"))
  assert.equal(headers.some((header: { key: string }) => header.key === 'Strict-Transport-Security'), false)
  assert.equal(config.images.remotePatterns.some((pattern: { hostname: string }) => pattern.hostname.includes('supabase')), false)
})

test('HTTPS protege produção e permite apenas o projeto Supabase configurado', async () => {
  const config = await loadConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://clareza.example', NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' })
  const patterns = config.images.remotePatterns
  assert.ok(patterns.some((pattern: { protocol: string; hostname: string; pathname?: string }) =>
    pattern.protocol === 'https' && pattern.hostname === 'project.supabase.co' && pattern.pathname === '/storage/v1/object/sign/**'
  ))
  assert.equal(patterns.some((pattern: { hostname: string }) => pattern.hostname.includes('**.supabase.co')), false)
  const headers = (await config.headers())[0].headers
  const csp = headers.find((header: { key: string }) => header.key === 'Content-Security-Policy').value
  assert.ok(csp.includes('upgrade-insecure-requests'))
  assert.equal(csp.includes("'unsafe-eval'"), false)
  assert.ok(headers.some((header: { key: string }) => header.key === 'Strict-Transport-Security'))
})

test('acesso de desenvolvimento por IP usa somente os hosts das origens configuradas', async () => {
  const config = await loadConfig({ BETTER_AUTH_TRUSTED_ORIGINS: 'http://172.22.11.31:3000,http://172.22.11.31:3001,http://localhost:3000' })
  assert.deepEqual(config.allowedDevOrigins, ['172.22.11.31', 'localhost'])
})

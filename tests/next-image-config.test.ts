import assert from 'node:assert/strict'
import test from 'node:test'
import nextConfig from '@/next.config.mjs'

test('next/image permite somente signed URLs do projeto Supabase configurado', () => {
  const patterns = nextConfig.images?.remotePatterns ?? []
  assert.ok(patterns.some(pattern =>
    pattern.protocol === 'https'
    && pattern.hostname === 'grjsehbkitlvzxhsacwa.supabase.co'
    && pattern.pathname === '/storage/v1/object/sign/**'
  ))
  assert.equal(patterns.some(pattern => pattern.hostname.includes('**.supabase.co')), false)
})

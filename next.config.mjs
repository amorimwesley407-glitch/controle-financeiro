/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null
const usesHttps = process.env.BETTER_AUTH_URL?.startsWith('https://') || (!process.env.BETTER_AUTH_URL && process.env.VERCEL === '1')
const isDevelopment = process.env.NODE_ENV === 'development'
const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)

const nextConfig = {
  allowedDevOrigins: [...new Set(trustedOrigins.map(origin => new URL(origin).hostname))],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'icons.brapi.dev' },
      ...(supabaseHost ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/sign/**' }] : []),
    ],
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`, "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://icons.brapi.dev", "font-src 'self' data:", "connect-src 'self'",
      ...(usesHttps ? ['upgrade-insecure-requests'] : []),
    ].join('; ')
    return [{ source: '/(.*)', headers: [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(usesHttps ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
    ] }, { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }]
  },
}

export default nextConfig

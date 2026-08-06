/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['169.254.83.107'],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'icons.brapi.dev' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'",
      "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://icons.brapi.dev", "font-src 'self' data:", "connect-src 'self'",
      'upgrade-insecure-requests',
    ].join('; ')
    return [{ source: '/(.*)', headers: [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ] }]
  },
}

export default nextConfig

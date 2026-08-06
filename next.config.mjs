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
}

export default nextConfig

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Clareza — Controle Financeiro',
    short_name: 'Clareza',
    description: 'Organize gastos, metas, orçamentos e investimentos em um só lugar.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0f14',
    theme_color: '#4f7cff',
    orientation: 'any',
    categories: ['finance', 'productivity'],
    lang: 'pt-BR',
    icons: [
      { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

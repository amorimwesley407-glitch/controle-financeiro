import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { PwaInstaller } from '@/components/pwa-installer'
import './globals.css'

export const metadata:Metadata={title:'Clareza — Controle financeiro',description:'Organize gastos, metas, orçamentos e investimentos em um só lugar.',applicationName:'Clareza',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'Clareza'},formatDetection:{telephone:false},icons:{icon:[{url:'/pwa-icon-192.png',sizes:'192x192',type:'image/png'},{url:'/pwa-icon-512.png',sizes:'512x512',type:'image/png'}],apple:[{url:'/pwa-icon-192.png',sizes:'192x192',type:'image/png'}]}}
export const viewport:Viewport={colorScheme:'light dark',themeColor:[{media:'(prefers-color-scheme: light)',color:'#f6f7f4'},{media:'(prefers-color-scheme: dark)',color:'#111512'}]}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" className="bg-background" suppressHydrationWarning><body className="font-sans antialiased"><ThemeProvider>{children}<PwaInstaller/><Toaster/>{process.env.VERCEL==='1'&&<Analytics/>}</ThemeProvider></body></html>}

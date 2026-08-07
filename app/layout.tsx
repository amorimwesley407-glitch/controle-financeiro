import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { PwaInstaller } from '@/components/pwa-installer'
import './globals.css'

const geist=Geist({subsets:['latin'],variable:'--font-geist'})
const mono=Geist_Mono({subsets:['latin'],variable:'--font-geist-mono'})
export const metadata:Metadata={title:'Clareza — Controle financeiro',description:'Organize gastos, metas, orçamentos e investimentos em um só lugar.',applicationName:'Clareza',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'Clareza'},formatDetection:{telephone:false},icons:{icon:[{url:'/pwa-icon-192.png',sizes:'192x192',type:'image/png'},{url:'/pwa-icon-512.png',sizes:'512x512',type:'image/png'}],apple:[{url:'/pwa-icon-192.png',sizes:'192x192',type:'image/png'}]}}
export const viewport:Viewport={colorScheme:'light dark',themeColor:[{media:'(prefers-color-scheme: light)',color:'#f6f7f4'},{media:'(prefers-color-scheme: dark)',color:'#111512'}]}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" className="bg-background" suppressHydrationWarning><body className={`${geist.variable} ${mono.variable} font-sans antialiased`}><ThemeProvider>{children}<PwaInstaller/><Toaster/>{process.env.NODE_ENV==='production'&&<Analytics/>}</ThemeProvider></body></html>}

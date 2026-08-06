import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geist=Geist({subsets:['latin'],variable:'--font-geist'})
const mono=Geist_Mono({subsets:['latin'],variable:'--font-geist-mono'})
export const metadata:Metadata={title:'Clareza — Controle financeiro',description:'Organize gastos, metas, orçamentos e investimentos em um só lugar.'}
export const viewport:Viewport={colorScheme:'light dark',themeColor:[{media:'(prefers-color-scheme: light)',color:'#f6f7f4'},{media:'(prefers-color-scheme: dark)',color:'#111512'}]}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" className="bg-background" suppressHydrationWarning><body className={`${geist.variable} ${mono.variable} font-sans antialiased`}><ThemeProvider>{children}<Toaster/>{process.env.NODE_ENV==='production'&&<Analytics/>}</ThemeProvider></body></html>}

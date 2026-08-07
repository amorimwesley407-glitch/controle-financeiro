'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstaller() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
    const capturePrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent) }
    const clearPrompt = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', clearPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', clearPrompt)
    }
  }, [])

  if (!installPrompt) return null
  return (
    <Button
      type="button"
      size="sm"
      className="fixed bottom-4 left-4 z-50 shadow-lg"
      onClick={async () => {
        await installPrompt.prompt()
        await installPrompt.userChoice
        setInstallPrompt(null)
      }}
    >
      <Download data-icon="inline-start" />
      Instalar Clareza
    </Button>
  )
}

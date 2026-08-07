import Link from 'next/link'
import { WifiOff, WalletCards } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-xl">
        <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><WalletCards /></span>
        <WifiOff className="mx-auto mb-4 size-9 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Você está offline</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Por segurança, seus dados financeiros não são armazenados neste dispositivo. Reconecte-se para acessar o painel.</p>
        <Link className={buttonVariants({ className: 'mt-6' })} href="/">Tentar novamente</Link>
      </section>
    </main>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle, WalletCards } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password })
      if (result.error) { setError(result.error.message || 'Não foi possível continuar.'); return }
      router.replace('/')
      router.refresh()
    } catch { setError('Falha de conexão. Tente novamente.') }
    finally { setLoading(false) }
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-2xl md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
          <div className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15"><WalletCards /></span>Clareza</div>
          <div className="flex flex-col gap-4"><p className="text-4xl font-semibold text-balance">Seu dinheiro, com mais intenção.</p><p className="leading-relaxed text-primary-foreground/75">Organize gastos, acompanhe metas e tome decisões financeiras com confiança.</p></div>
          <p className="text-sm text-primary-foreground/65">Controle financeiro pessoal e privado</p>
        </section>
        <Card className="border-0 shadow-none">
          <CardHeader className="px-6 pt-8 md:px-10 md:pt-10"><CardTitle className="text-2xl">{isSignUp ? 'Crie sua conta' : 'Bem-vindo de volta'}</CardTitle><CardDescription>{isSignUp ? 'Comece a cuidar melhor do seu futuro financeiro.' : 'Entre para acessar seu painel financeiro.'}</CardDescription></CardHeader>
          <CardContent className="px-6 pb-8 md:px-10 md:pb-10">
            <form onSubmit={submit} className="flex flex-col gap-4">
              {isSignUp && <div className="flex flex-col gap-2"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={event => setName(event.target.value)} required autoComplete="name" /></div>}
              <div className="flex flex-col gap-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={isSignUp ? 12 : 8} maxLength={128} required autoComplete={isSignUp ? 'new-password' : 'current-password'} />{isSignUp && <p className="text-xs text-muted-foreground">Use pelo menos 12 caracteres.</p>}</div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={loading}>{loading && <LoaderCircle data-icon="inline-start" className="animate-spin" />}{isSignUp ? 'Criar conta' : 'Entrar'}</Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">{isSignUp ? 'Já possui uma conta? ' : 'Ainda não possui conta? '}<Link className="font-medium text-foreground underline-offset-4 hover:underline" href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Entrar' : 'Criar conta'}</Link></p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function Shell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-2xl">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {children}
          <p className="text-center text-sm text-muted-foreground"><Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/sign-in">Voltar para o login</Link></p>
        </CardContent>
      </Card>
    </main>
  )
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: '/reset-password' })
      if (result.error) setError(result.error.status === 429 ? 'Muitas tentativas. Aguarde um pouco e tente de novo.' : 'Não foi possível enviar agora. Tente novamente.')
      else setSent(true)
    } catch { setError('Falha de conexão. Tente novamente.') }
    finally { setLoading(false) }
  }

  if (sent) return <Shell title="Verifique seu e-mail" description={`Se houver uma conta para ${email.trim()}, enviamos um link para redefinir a senha. Ele vale por 1 hora; confira também a caixa de spam.`}>{null}</Shell>
  return (
    <Shell title="Esqueceu a senha?" description="Informe seu e-mail e enviaremos um link para criar uma nova senha.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading}>{loading && <LoaderCircle data-icon="inline-start" className="animate-spin" />}Enviar link</Button>
      </form>
    </Shell>
  )
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!token) return <Shell title="Link inválido" description="Este link expirou ou já foi usado."><Button render={<Link href="/forgot-password" />} size="lg">Pedir um novo link</Button></Shell>

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirmation) { setError('As senhas não são iguais.'); return }
    setLoading(true)
    setError('')
    try {
      const result = await authClient.resetPassword({ newPassword: password, token: token! })
      if (result.error) { setError('Não foi possível redefinir: o link pode ter expirado. Peça um novo.'); return }
      router.replace('/sign-in')
    } catch { setError('Falha de conexão. Tente novamente.') }
    finally { setLoading(false) }
  }

  return (
    <Shell title="Crie uma nova senha" description="Use pelo menos 12 caracteres. Ao salvar, as outras sessões abertas serão encerradas.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><Label htmlFor="password">Nova senha</Label><Input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} required autoComplete="new-password" /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="confirmation">Repita a nova senha</Label><Input id="confirmation" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={128} required autoComplete="new-password" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading}>{loading && <LoaderCircle data-icon="inline-start" className="animate-spin" />}Salvar nova senha</Button>
      </form>
    </Shell>
  )
}

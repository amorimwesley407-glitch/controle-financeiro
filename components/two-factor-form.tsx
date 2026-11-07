'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Shell } from '@/components/password-reset-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const messages: Record<string, string> = {
  INVALID_CODE: 'Código incorreto. Confira o app autenticador e tente de novo.',
  INVALID_BACKUP_CODE: 'Código de recuperação incorreto ou já usado.',
  ACCOUNT_TEMPORARILY_LOCKED: 'Muitas tentativas erradas. A conta ficou bloqueada por alguns minutos.',
  INVALID_TWO_FACTOR_COOKIE: 'A verificação expirou. Volte para o login e entre de novo.',
}

/** Segunda etapa do login: o código de 6 dígitos do app autenticador ou um código de recuperação. */
export function TwoFactorForm() {
  const router = useRouter()
  const [useBackup, setUseBackup] = useState(false)
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = useBackup
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice })
        : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ''), trustDevice })
      if (result.error) {
        setError(result.error.status === 429 ? 'Muitas tentativas. Aguarde alguns segundos.' : messages[result.error.code ?? ''] ?? 'Não foi possível verificar o código.')
        return
      }
      router.replace('/')
      router.refresh()
    } catch { setError('Falha de conexão. Tente novamente.') }
    finally { setLoading(false) }
  }

  return (
    <Shell
      title="Verificação em duas etapas"
      description={useBackup ? 'Digite um dos códigos de recuperação que você guardou. Cada um funciona uma vez só.' : 'Abra o app autenticador e digite o código de 6 dígitos do Clareza.'}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">{useBackup ? 'Código de recuperação' : 'Código do app'}</Label>
          <Input
            id="code"
            value={code}
            onChange={event => setCode(event.target.value)}
            inputMode={useBackup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={useBackup ? 'abcde-12345' : '123456'}
            maxLength={useBackup ? 11 : 7}
            className="font-mono text-lg tracking-widest"
            autoFocus
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={trustDevice} onChange={event => setTrustDevice(event.target.checked)} />
          Confiar neste aparelho por 30 dias
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading}>{loading && <LoaderCircle data-icon="inline-start" className="animate-spin" />}Verificar</Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => { setUseBackup(value => !value); setCode(''); setError('') }}
        >
          {useBackup ? 'Usar o código do app autenticador' : 'Perdeu o acesso ao app? Use um código de recuperação'}
        </button>
      </form>
    </Shell>
  )
}

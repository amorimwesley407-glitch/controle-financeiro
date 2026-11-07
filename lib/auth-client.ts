import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

// O redirecionamento para /two-factor fica com a tela de login, que já trata o resultado do signIn.
export const authClient = createAuthClient({ plugins: [twoFactorClient()] })

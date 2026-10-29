import { APIError, createAuthMiddleware } from 'better-auth/api'

// O campo "image" do usuário só pode ser alterado pelo updateUserProfile, que faz o upload na pasta do próprio usuário.
// Sem isto, /update-user aceitaria qualquer texto, inclusive o caminho da imagem de outra pessoa.
export const blockAuthImageInput = createAuthMiddleware(async ctx => {
  if ((ctx.path === '/update-user' || ctx.path === '/sign-up/email') && ctx.body && typeof ctx.body === 'object' && Object.hasOwn(ctx.body, 'image')) {
    throw new APIError('FORBIDDEN', { message: 'A foto de perfil deve ser alterada pela tela de Configurações' })
  }
})

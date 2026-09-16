import { APIError, createAuthMiddleware } from 'better-auth/api'

export const blockGenericAuthImageInput = createAuthMiddleware(async (ctx) => {
  if (
    (ctx.path === '/update-user' || ctx.path === '/sign-up/email') &&
    ctx.body &&
    typeof ctx.body === 'object' &&
    Object.prototype.hasOwnProperty.call(ctx.body, 'image')
  ) {
    throw new APIError('FORBIDDEN', { message: 'A imagem deve ser atualizada pelo fluxo protegido de perfil' })
  }
})

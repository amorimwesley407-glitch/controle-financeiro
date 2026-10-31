/** Envia um e-mail pela API do Resend. Exige RESEND_API_KEY e EMAIL_FROM. */
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) throw new Error('Configure RESEND_API_KEY e EMAIL_FROM para enviar e-mails')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Falha ao enviar e-mail: ${response.status}`)
}

export async function sendPasswordResetEmail(to: string, url: string) {
  // O link dá acesso à conta: não pode aparecer em logs nem em mensagens de erro.
  const href = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  await sendEmail({
    to,
    subject: 'Redefina sua senha do Clareza',
    text: `Recebemos um pedido para redefinir sua senha.\n\nAbra este link em até 1 hora:\n${url}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html: `<p>Recebemos um pedido para redefinir sua senha.</p><p><a href="${href}">Redefinir minha senha</a></p><p>O link vale por 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
  })
}

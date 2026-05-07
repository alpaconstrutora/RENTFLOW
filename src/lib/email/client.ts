import { Resend } from 'resend'

// Instância singleton — lida com RESEND_API_KEY ausente em dev/test
// sem lançar erro no import.
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY não configurada. Veja .env.local.')
    _resend = new Resend(key)
  }
  return _resend
}

// Endereço remetente verificado no painel Resend.
// Em dev pode usar o endereço sandbox do Resend.
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

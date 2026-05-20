'use server'

import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'

export async function loginWithMagicLink(formData: FormData) {
  const email = formData.get('email') as string

  if (!email) {
    return redirect('/login?message=Email é obrigatório')
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  })

  if (error) {
    return redirect(`/login?message=${encodeURIComponent(`[DEBUG] ${error.status} — ${error.message}`)}`)
  }

  // Lógica inteligente pura do Next.js sem usar um pingo de JavaScript no front-end.
  // Avança a etapa via Search Params!
  return redirect(`/login?step=verify&email=${encodeURIComponent(email)}&message=Código enviado!`)
}

export async function verifyOtpCode(formData: FormData) {
  const email = formData.get('email') as string
  const token = formData.get('token') as string

  if (!token || token.length < 6 || token.length > 8) {
    return redirect(`/login?step=verify&email=${encodeURIComponent(email)}&message=Código inválido (6-8 dígitos esperados).`)
  }

  const supabase = await createClient()
  
  const { error } = await supabase.auth.verifyOtp({ 
    email, 
    token, 
    type: 'email'
  })

  if (error) {
    return redirect(`/login?step=verify&email=${encodeURIComponent(email)}&message=Código incorreto ou expirado.`)
  }

  // Token validado? Pouso seguro no Painel Institucional!
  return redirect('/dashboard')
}

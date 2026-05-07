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
    return redirect('/login?message=Não foi possível despachar o código. Erro no servidor.')
  }

  // Lógica inteligente pura do Next.js sem usar um pingo de JavaScript no front-end.
  // Avança a etapa via Search Params!
  return redirect(`/login?step=verify&email=${encodeURIComponent(email)}&message=Cheque o Mailpit!`)
}

export async function verifyOtpCode(formData: FormData) {
  const email = formData.get('email') as string
  const token = formData.get('token') as string

  if (!token || token.length !== 6) {
    return redirect(`/login?step=verify&email=${encodeURIComponent(email)}&message=Código de 6 dígitos inválido.`)
  }

  const supabase = await createClient()
  
  const { error } = await supabase.auth.verifyOtp({ 
    email, 
    token, 
    type: 'magiclink' // O Supabase reconhece códigos OTP via a configuração de links
  })

  if (error) {
    return redirect(`/login?step=verify&email=${encodeURIComponent(email)}&message=Código incorreto ou expirado.`)
  }

  // Token validado? Pouso seguro no Painel Institucional!
  return redirect('/dashboard')
}

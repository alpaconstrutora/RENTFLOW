import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // Utilizado para voltar à URL intencionada após login
  const rawNext = searchParams.get('next') ?? '/dashboard'
  // Validar redirect: deve começar com / e não pode ser protocol-relative (//)
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
       return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Falha na troca do token
  return NextResponse.redirect(`${origin}/login?message=Código de acesso expirado ou inválido. Tente novamente.`)
}

import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from './server'

// Lê user.id do header setado pelo middleware (sem roundtrip de rede).
// Fallback para supabase.auth.getUser() se o header faltar — garante que
// rotas onde o middleware não rodou ainda funcionem.
// React cache() deduplica chamadas dentro do mesmo render.
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const hdrs = await headers()
  const fromHeader = hdrs.get('x-rentflow-user-id')
  if (fromHeader) return fromHeader

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
})

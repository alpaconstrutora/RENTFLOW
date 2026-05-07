'use server'

import { createClient } from '../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertTaxSettings(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const ibsRate = parseFloat(formData.get('ibs_rate') as string) / 100
    const cbsRate = parseFloat(formData.get('cbs_rate') as string) / 100

    if (isNaN(ibsRate) || ibsRate < 0 || isNaN(cbsRate) || cbsRate < 0) return "Alíquotas devem ser valores não-negativos."

    const { error } = await supabase.from('tax_config')
      .upsert({
        user_id: user.id, // Supabase UNIQUE constraint garante apenas 1 perfil
        ibs_rate: ibsRate,
        cbs_rate: cbsRate,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (error) return error.message

    revalidatePath('/dashboard/impostos')
    return null
  } catch (err) {
    return (err as Error).message || "Falha técnica ao atualizar motor de impostos"
  }
}

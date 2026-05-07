'use server'

import { createClient } from '../../../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateWithheldIrrf(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Erro de autenticação.'

  const transactionId = formData.get('transaction_id') as string
  const billingMonth  = formData.get('billing_month')  as string
  const rawValue      = formData.get('withheld_irrf')   as string

  const withheldIrrf = parseFloat(rawValue.replace(',', '.'))
  if (isNaN(withheldIrrf) || withheldIrrf < 0) return 'Valor de IRRF inválido.'

  const { error } = await supabase
    .from('transactions')
    .update({ withheld_irrf: withheldIrrf })
    .eq('id', transactionId)
    .eq('user_id', user.id)

  if (error) return error.message

  // Recomputa o carnê-leão do mês após alterar o IRRF retido
  await supabase.rpc('recompute_month_irpf', {
    p_user_id:       user.id,
    p_billing_month: billingMonth + '-01',
  })

  revalidatePath(`/dashboard/impostos/carne-leao/${billingMonth}`)
  return null
}

export async function recalculateMonthIrpf(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Erro de autenticação.'

  const billingMonth = formData.get('billing_month') as string

  const { error } = await supabase.rpc('recompute_month_irpf', {
    p_user_id:       user.id,
    p_billing_month: billingMonth + '-01',
  })

  if (error) return error.message

  revalidatePath(`/dashboard/impostos/carne-leao/${billingMonth}`)
  return null
}

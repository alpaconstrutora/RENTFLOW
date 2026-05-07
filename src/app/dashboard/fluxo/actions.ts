'use server'

import { createClient } from '../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

// I5: Criação manual de transação (receita ou despesa)
export async function createTransactionAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const type = formData.get('type') as string
    const amount = parseFloat(formData.get('amount') as string)
    const propertyId = formData.get('property_id') as string
    const leaseId = formData.get('lease_id') as string || null
    const notes = formData.get('notes') as string || null
    const dueDateRaw = formData.get('due_date') as string

    if (!type || !amount || !propertyId || !dueDateRaw) return "Campos obrigatórios ausentes."
    if (isNaN(amount) || amount <= 0) return "Valor deve ser positivo."

    // C1: billing_month = 1º dia do mês da due_date (DATE_TRUNC semantics)
    const [dueDateYear, dueDateMonth] = dueDateRaw.split('-')
    const billingMonth = `${dueDateYear}-${dueDateMonth}-01`

    // INVARIANTE #2: Receita DEVE ter lease_id (constraint no banco)
    if (type === 'income' && !leaseId) {
      return "Receitas devem estar vinculadas a um Contrato de Locação (Invariante #2)."
    }

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      property_id: propertyId,
      lease_id: leaseId,
      type,
      amount,
      due_date: dueDateRaw,
      billing_month: billingMonth,
      status: 'pending',
      is_auto_generated: false,
      recurrence: 'none',
      notes
    })

    if (error) return error.message

    // I10: domain_event — criação manual de transação
    await supabase.from('domain_events').insert({
      user_id: user.id,
      event_type: 'payment_received',
      event_version: 1,
      source: 'user',
      payload: {
        entity_id: null,
        entity_type: 'transaction',
        timestamp: new Date().toISOString(),
        context: { type, amount, property_id: propertyId, billing_month: billingMonth }
      }
    })

    revalidatePath('/dashboard/fluxo')
    revalidatePath('/dashboard')
    return null
  } catch (err) {
    return (err as Error).message || "Erro desconhecido"
  }
}

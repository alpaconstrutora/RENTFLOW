'use server'

import { createClient } from '../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateMockData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // C4: user_today para data correta no timezone do usuário
  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
  const today = (todayStr as string | null) ?? new Date().toLocaleString('sv', { timeZone: 'America/Sao_Paulo' }).split(' ')[0]
  const [year, month] = today.split('-')
  const billingMonth = `${year}-${month}-01`
  const dueDate = `${year}-${month}-10`

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({ user_id: user.id, name: 'João Fictício (Mock)', email: 'joao@ficticio.com' })
    .select('id').single()
  if (tenantErr) throw new Error('Falha ao criar Inquilino: ' + tenantErr.message)

  const { data: property, error: propErr } = await supabase
    .from('properties')
    .insert({
      user_id: user.id,
      name: 'Edifício Corporate Tower',
      type: 'commercial',
      status: 'rented',
      purchase_value: 2000000,
      expected_rent: 14000
    })
    .select('id').single()
  if (propErr) throw new Error('Falha ao criar Imóvel: ' + propErr.message)

  const { data: lease, error: leaseErr } = await supabase
    .from('leases')
    .insert({
      user_id: user.id,
      property_id: property.id,
      tenant_id: tenant.id,
      rent_value: 14000,
      due_day: 10,
      start_date: `${year}-${month}-01`,
      active: true
    })
    .select('id').single()
  if (leaseErr) throw new Error('Falha ao criar Contrato: ' + leaseErr.message)

  const { error: txErr } = await supabase.from('transactions').insert([
    {
      user_id: user.id, property_id: property.id, lease_id: lease.id,
      type: 'income', amount: 14000.00,
      due_date: dueDate, billing_month: billingMonth,
      status: 'paid', is_auto_generated: false, recurrence: 'none'
    },
    {
      user_id: user.id, property_id: property.id,
      type: 'expense', amount: 2500.00,
      due_date: dueDate, billing_month: billingMonth,
      status: 'paid', is_auto_generated: false, recurrence: 'none'
    }
  ])
  if (txErr) throw new Error('Falha ao gerar Transações: ' + txErr.message)

  revalidatePath('/dashboard')
}

// ════════════════════════════════════════════════════════════════
// [v6] Optimistic Lock via xmin + paid_date via user_today()
// Substitui updated_at por xmin conforme Prompt v6.0
// ════════════════════════════════════════════════════════════════
export async function updateTransactionWithOptimisticLock(id: string, newStatus: string, expectedXmin: string, overridePaidDate?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Obter dados da transação para IBS/CBS e domain_events
  const { data: txOrig } = await supabase
    .from('transactions_view')
    .select('type, amount, property_id, status, due_date, is_auto_generated, lease_id')
    .eq('id', id)
    .single()

  // [v6] paid_date via user_today() — nunca new Date() do JS; overridePaidDate quando usuário especifica
  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
  const paidDate = newStatus === 'paid' ? (overridePaidDate ?? (todayStr as string)) : null

  // [v6] RPC com xmin — nunca updated_at
  const { error: rpcError } = await supabase.rpc('update_transaction_optimistic', {
    p_id: id,
    p_expected_xmin: expectedXmin,
    p_new_status: newStatus,
    p_paid_date: paidDate
  })

  if (rpcError) throw new Error(rpcError.message)

  if (newStatus === 'paid' && txOrig?.status !== 'paid') {
    await supabase.rpc('log_domain_event', {
      p_event_type: 'payment_received',
      p_payload: {
        entity_id: id,
        entity_type: 'transaction',
        timestamp: new Date().toISOString(),
        context: { transaction_id: id, amount: txOrig?.amount, paid_date: paidDate, property_id: txOrig?.property_id }
      }
    })
  }

  // ════════════════════════════════════════════════════════════════
  // MOTOR TRIBUTÁRIO IBS/CBS — via RPC atômica (SQL transaction)
  // ════════════════════════════════════════════════════════════════
  if (txOrig && txOrig.type === 'income' && newStatus === 'paid' && txOrig.status !== 'paid') {
    await supabase.rpc('apply_tax_on_payment', {
      p_transaction_id: id,
      p_user_id: user.id
    })
  }

  revalidatePath('/dashboard/fluxo')
  revalidatePath('/dashboard')
  return true
}

// ════════════════════════════════════════════════════════════════
// Transação de Ajuste (parent_transaction_id) — PENDENTE D4
// Para auto-gerada paid: cria transação de ajuste vinculada
// ════════════════════════════════════════════════════════════════
export async function createAdjustmentTransaction(
  parentId: string,
  amount: number,
  notes: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Buscar transação original
  const { data: parent } = await supabase
    .from('transactions')
    .select('property_id, lease_id, due_date, billing_month, paid_date, type')
    .eq('id', parentId)
    .single()

  if (!parent) throw new Error('Transação original não encontrada.')

  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    property_id: parent.property_id,
    lease_id: parent.lease_id,
    type: parent.type,
    amount: amount,
    due_date: parent.due_date,
    billing_month: parent.billing_month,
    paid_date: todayStr as string,
    status: 'paid',
    is_auto_generated: false,
    recurrence: 'none',
    parent_transaction_id: parentId,
    notes: notes || `Ajuste ref. ${(parent.billing_month as string)?.slice(0, 7)}`
  })

  if (error) throw new Error(error.message)

  await supabase.rpc('log_domain_event', {
    p_event_type: 'payment_received',
    p_payload: {
      entity_id: parentId,
      entity_type: 'transaction',
      timestamp: new Date().toISOString(),
      context: { amount, parent_transaction_id: parentId, notes }
    }
  })

  revalidatePath('/dashboard/fluxo')
  revalidatePath('/dashboard')
  return true
}

// ════════════════════════════════════════════════════════════════
// Editar campos de transação (notas, categoria) — xmin lock
// ════════════════════════════════════════════════════════════════
export async function editTransactionFieldsAction(
  id: string,
  xmin: string,
  notes: string | null,
  categoryId: string | null,
  scope: 'this' | 'all',
  groupId: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (scope === 'all' && groupId) {
    // Editar todas as ocorrências da série
    const { error } = await supabase.rpc('edit_recurring_series', {
      p_group_id: groupId,
      p_notes: notes,
      p_category_id: categoryId
    })
    if (error) throw new Error(error.message)
  } else {
    // Editar só esta ocorrência
    const { error } = await supabase.rpc('edit_transaction_fields', {
      p_id: id,
      p_expected_xmin: xmin,
      p_notes: notes,
      p_category_id: categoryId
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/dashboard/fluxo')
  revalidatePath('/dashboard')
  return true
}

export async function applyTransactionAdjustmentAction(
  id: string,
  xmin: string,
  discount: number,
  addition: number,
  notes: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.rpc('apply_transaction_adjustment', {
    p_id: id,
    p_expected_xmin: xmin,
    p_discount: discount,
    p_addition: addition,
    p_notes: notes
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/fluxo')
  revalidatePath('/dashboard')
  return true
}

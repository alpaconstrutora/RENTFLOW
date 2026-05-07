'use server'

import { createClient } from '../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateContratoPdfBuffer, buildContratoPdfData } from '../../../lib/pdf/generateContratoPdfBuffer'
import { formatBRL } from '../../../lib/valorPorExtenso'

async function saveLeaseSnapshot(
  supabase: SupabaseClient,
  leaseId: string,
  userId: string,
  label: string
) {
  try {
    const [{ data: leaseFullRaw }, { data: propertyRaw }, userRes] = await Promise.all([
      supabase.from('leases').select('rent_value, due_day, start_date, end_date, adjustment_index, adjustment_period_months, property_id, tenant_id, landlord_profile_id').eq('id', leaseId).single(),
      supabase.from('leases').select('properties(name, address, city, state)').eq('id', leaseId).single(),
      supabase.auth.getUser(),
    ])
    if (!leaseFullRaw) return

    const lease = { rent_value: leaseFullRaw.rent_value, due_day: leaseFullRaw.due_day, start_date: leaseFullRaw.start_date, end_date: leaseFullRaw.end_date, adjustment_index: leaseFullRaw.adjustment_index, adjustment_period_months: leaseFullRaw.adjustment_period_months }

    const [{ data: tenantRaw }, { data: landlordProfileRaw }] = await Promise.all([
      supabase.from('tenants').select('name, document, email, phone, street, street_number, district, city, state').eq('id', leaseFullRaw.tenant_id).single(),
      leaseFullRaw.landlord_profile_id
        ? supabase.from('landlord_profiles').select('name, document, phone, address').eq('id', leaseFullRaw.landlord_profile_id).single()
        : supabase.from('landlord_profiles').select('name, document, phone, address').eq('is_default', true).maybeSingle(),
    ])

    const property = (propertyRaw as { properties: unknown })?.properties as Parameters<typeof buildContratoPdfData>[0]['property']
    const userEmail = userRes.data.user?.email ?? '—'
    const ownerData = {
      name:     (landlordProfileRaw as { name?: string } | null)?.name     ?? userEmail,
      document: (landlordProfileRaw as { document?: string | null } | null)?.document ?? null,
      phone:    (landlordProfileRaw as { phone?: string | null } | null)?.phone    ?? null,
      address:  (landlordProfileRaw as { address?: string | null } | null)?.address  ?? null,
    }

    const pdfData = buildContratoPdfData({
      leaseId,
      lease,
      property,
      tenant: tenantRaw as Parameters<typeof buildContratoPdfData>[0]['tenant'],
      owner: ownerData,
    })

    const buffer = await generateContratoPdfBuffer(pdfData)

    const { count } = await supabase
      .from('lease_documents')
      .select('*', { count: 'exact', head: true })
      .eq('lease_id', leaseId)

    const version = (count ?? 0) + 1
    const storagePath = `${userId}/${leaseId}/v${version}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('lease-documents')
      .upload(storagePath, new Uint8Array(buffer), { contentType: 'application/pdf', upsert: false })

    if (uploadErr) return

    await supabase.from('lease_documents').insert({
      user_id: userId,
      lease_id: leaseId,
      version,
      storage_path: storagePath,
      label,
    })
  } catch {
    // Snapshot é best-effort: falha não bloqueia a operação principal
  }
}

/**
 * Retorna o billing_month (dia 1 do mês vigente) usando user_today() via RPC.
 * C4: Nunca usar new Date() do JS — timezone do servidor ≠ timezone do usuário.
 * C1: billing_month é SEMPRE o dia 1 do mês (DATE_TRUNC semantics).
 */
async function getUserBillingMonth(supabase: SupabaseClient, userId: string): Promise<{ billingMonth: string; today: string }> {
  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: userId })
  // Null-safe: fallback America/Sao_Paulo se profile ainda não existir
  const safeToday = (todayStr as string | null) ?? new Date().toLocaleString('sv', { timeZone: 'America/Sao_Paulo' }).split(' ')[0]
  const [year, month] = safeToday.split('-')
  const billingMonth = `${year}-${month}-01` // DATE_TRUNC('month', ...)
  return { billingMonth, today: safeToday }
}

/**
 * Calcula o due_date respeitando meses curtos — equivalente ao MAKE_DATE+LEAST do prompt.
 * Ex: due_day=31 em fevereiro → dia 28.
 */
function calcDueDate(year: number, month: number, dueDay: number): string {
  // Last day of month: day 0 of next month
  const lastDay = new Date(year, month, 0).getDate()
  const actualDay = Math.min(dueDay, lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`
}

export async function createLeaseAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const propertyId = formData.get('property_id') as string
    const tenantId = formData.get('tenant_id') as string
    const rentValue = parseFloat(formData.get('rent_value') as string)
    const dueDay = parseInt(formData.get('due_day') as string)
    const startDate = formData.get('start_date') as string
    const endDate = (formData.get('end_date') as string) || null
    const adjustmentPeriodMonths = parseInt(formData.get('adjustment_period_months') as string) || 12
    const adjustmentIndex = (formData.get('adjustment_index') as string) || 'IGPM'
    const adjustmentBaseDate = (formData.get('adjustment_base_date') as string) || null
    const billingStartDateRaw = (formData.get('billing_start_date') as string) || null
    const iptuPaidBy         = (formData.get('iptu_paid_by')          as string) || 'tenant'
    const condoPaidBy        = (formData.get('condo_paid_by')         as string) || 'tenant'
    const landlordProfileId  = (formData.get('landlord_profile_id')   as string) || null

    if (!propertyId || !tenantId || !startDate) {
      return "Campos obrigatórios ausentes."
    }
    if (isNaN(rentValue) || rentValue <= 0) return "Valor do aluguel deve ser positivo."

    const { data: insertedLease, error } = await supabase.from('leases').insert({
      user_id: user.id,
      property_id: propertyId,
      tenant_id: tenantId,
      rent_value: rentValue,
      due_day: dueDay,
      start_date: startDate,
      end_date: endDate,
      adjustment_period_months: adjustmentPeriodMonths,
      adjustment_index: adjustmentIndex,
      adjustment_base_date: adjustmentBaseDate || startDate,
      billing_start_date:  billingStartDateRaw || null,
      iptu_paid_by:        iptuPaidBy,
      condo_paid_by:       condoPaidBy,
      landlord_profile_id: landlordProfileId || null,
      active: true
    }).select('id').single()

    if (error) return error.message

    // C1 + C4: billing_month via user_today() — nunca new Date() do JS
    const { billingMonth, today } = await getUserBillingMonth(supabase, user.id)
    const [year, month] = today.split('-').map(Number)
    const [todayYear, todayMonth] = [year, month]
    const currentMonthStart = new Date(Date.UTC(todayYear, todayMonth - 1, 1))

    // Efetivo início das parcelas — respeita carência
    const effectiveBillingStart = billingStartDateRaw || startDate
    const billingStartObj = new Date(effectiveBillingStart + 'T00:00:00Z')

    // Só cria parcela do mês atual se billing_start_date já chegou
    if (billingStartObj <= currentMonthStart) {
      const dueDate = calcDueDate(year, month, dueDay)
      await supabase.from('transactions').insert({
        user_id: user.id,
        lease_id: insertedLease.id,
        property_id: propertyId,
        type: 'income',
        amount: rentValue,
        due_date: dueDate,
        billing_month: billingMonth, // C1: sempre dia 1 do mês
        status: 'pending'
      })
    }

    // I1: Detectar retroativo com base em billing_start_date, não start_date
    const startDateObj = new Date(effectiveBillingStart + 'T00:00:00Z')
    
    // I10: domain_event contract_created — SEMPRE emitido, mesmo em retroativo
    await supabase.from('domain_events').insert({
      user_id: user.id,
      event_type: 'contract_created',
      event_version: 1,
      source: 'user',
      payload: {
        entity_id: insertedLease.id,
        entity_type: 'lease',
        timestamp: new Date().toISOString(),
        context: { start_date: startDate, rent_value: rentValue, property_id: propertyId, tenant_id: tenantId }
      }
    })

    // Calcular próximo reajuste automaticamente
    await supabase.rpc('recalc_next_adjustment', { p_lease_id: insertedLease.id })

    if (startDateObj < currentMonthStart) {
      const startYear = startDateObj.getUTCFullYear()
      const startMonth = startDateObj.getUTCMonth() + 1
      const months = (todayYear - startYear) * 12 + (todayMonth - startMonth)
      const startMonthLabel = startDateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      revalidatePath('/dashboard/contratos')
      revalidatePath('/dashboard/fluxo')
      await saveLeaseSnapshot(supabase, insertedLease.id, user.id, `Contrato inicial — ${new Date().toLocaleDateString('pt-BR')}`)
      return { backfill: { leaseId: insertedLease.id, months, startMonth: startMonthLabel } }
    }

    revalidatePath('/dashboard/contratos')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/fluxo')
    await saveLeaseSnapshot(supabase, insertedLease.id, user.id, `Contrato inicial — ${new Date().toLocaleDateString('pt-BR')}`)
    return null
  } catch (err) {
    return (err as Error).message || "Erro de integridade do Banco."
  }
}

// I1: Backfill retroativo de mensalidades — query exata do Prompt v6.0
export async function runBackfillAction(leaseId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    console.log('[runBackfillAction] starting for lease:', leaseId)
    const { data: count, error } = await supabase.rpc('backfill_lease_history', { p_lease_id: leaseId })
    console.log('[runBackfillAction] rpc result:', count, error)
    if (error) return error.message

    // PENDENTE D3: domain_event backfill_generated (source='user')
    const { error: eventError } = await supabase.from('domain_events').insert({
      user_id: user.id,
      event_type: 'backfill_generated',
      event_version: 1,
      source: 'user',
      payload: {
        entity_id: leaseId,
        entity_type: 'lease',
        timestamp: new Date().toISOString(),
        context: {
          lease_id: leaseId,
          months_count: count ?? 0
        }
      }
    })
    console.log('[runBackfillAction] domain_event result:', eventError)
    if (eventError) return eventError.message

    revalidatePath('/dashboard/contratos')
    revalidatePath('/dashboard/fluxo')
    revalidatePath('/dashboard')
    return null
  } catch (err) {
    return (err as Error).message || "Erro no backfill retroativo"
  }
}

export async function updateLeaseAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const id = formData.get('id') as string
    const newRentValue = parseFloat(formData.get('rent_value') as string)
    const dueDay = parseInt(formData.get('due_day') as string)
    const indexUsed = formData.get('index_used') as string || null
    const notes = formData.get('notes') as string || null
    // Cláusula de reajuste (opcionais — só altera se enviados)
    const endDate = formData.has('end_date') ? ((formData.get('end_date') as string) || null) : undefined
    const adjPeriod = formData.has('adjustment_period_months') ? (parseInt(formData.get('adjustment_period_months') as string) || 12) : undefined
    const adjIndex = formData.has('adjustment_index') ? ((formData.get('adjustment_index') as string) || 'IGPM') : undefined
    const billingStartDate = formData.has('billing_start_date') ? ((formData.get('billing_start_date') as string) || null) : undefined
    const iptuPaidBy        = formData.has('iptu_paid_by')         ? (formData.get('iptu_paid_by')         as string) : undefined
    const condoPaidBy       = formData.has('condo_paid_by')        ? (formData.get('condo_paid_by')        as string) : undefined
    const landlordProfileId = formData.has('landlord_profile_id')  ? ((formData.get('landlord_profile_id') as string) || null) : undefined

    if (isNaN(newRentValue) || newRentValue <= 0) return "Valor do aluguel deve ser positivo."

    // I8: Buscar valor anterior para registrar histórico de reajuste
    const { data: currentLease } = await supabase
      .from('leases')
      .select('rent_value')
      .eq('id', id)
      .single()

    const updatePayload: Record<string, unknown> = { rent_value: newRentValue, due_day: dueDay }
    if (endDate !== undefined) updatePayload.end_date = endDate
    if (adjPeriod !== undefined) updatePayload.adjustment_period_months = adjPeriod
    if (adjIndex !== undefined) updatePayload.adjustment_index = adjIndex
    if (iptuPaidBy        !== undefined) updatePayload.iptu_paid_by        = iptuPaidBy
    if (condoPaidBy       !== undefined) updatePayload.condo_paid_by       = condoPaidBy
    if (landlordProfileId !== undefined) updatePayload.landlord_profile_id = landlordProfileId

    const { error } = await supabase.from('leases')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message

    // billing_start_date via RPC própria — cancela parcelas pendentes anteriores se necessário
    if (billingStartDate !== undefined && billingStartDate !== null) {
      const { error: bsdErr } = await supabase.rpc('update_billing_start_date', {
        p_lease_id: id,
        p_billing_start_date: billingStartDate,
      })
      if (bsdErr) return bsdErr.message
    }

    // I8: Gravar em rent_history se o valor mudou
    if (currentLease && currentLease.rent_value !== newRentValue) {
      const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
      await supabase.from('rent_history').insert({
        lease_id: id,
        user_id: user.id,
        previous_value: currentLease.rent_value,
        new_value: newRentValue,
        index_used: indexUsed,
        adjustment_date: todayStr,
        notes: notes
      })
      // Avançar automaticamente o próximo reajuste após aplicar
      await supabase.rpc('recalc_next_adjustment', { p_lease_id: id })
      await saveLeaseSnapshot(supabase, id, user.id, `Reajuste: ${formatBRL(currentLease.rent_value)} → ${formatBRL(newRentValue)}`)
    }

    revalidatePath('/dashboard/contratos')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/fluxo')
    return null
  } catch (err) {
    return (err as Error).message || "Erro desconhecido"
  }
}

export async function triggerBillingEngineAction() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Erro de Autenticação", count: 0 }

    // INVARIANTE #11 — Advisory Lock obrigatório em todos os jobs
    const { data: acquired } = await supabase.rpc('try_acquire_job_lock', { p_job_name: 'generate-rents' })

    if (!acquired) {
      return { error: "Job já está em execução por outro operador (Advisory Lock ativo). Aguarde.", count: 0 }
    }

    try {
      const { data: rentCount, error: rentError } = await supabase.rpc('generate_monthly_rents')
      if (rentError) throw new Error(rentError.message)

      const { data: expCount, error: expError } = await supabase.rpc('generate_recurring_expenses')
      if (expError) throw new Error(expError.message)

      revalidatePath('/dashboard/contratos')
      revalidatePath('/dashboard/fluxo')
      revalidatePath('/dashboard')

      return { error: null, count: (rentCount || 0) + (expCount || 0) }
    } finally {
      // INVARIANTE #11: Liberar SEMPRE — success ou failure
      await supabase.rpc('release_job_lock', { p_job_name: 'generate-rents' })
    }
  } catch (err) {
    return { error: (err as Error).message || "Erro desconhecido", count: 0 }
  }
}

export async function revertTransactionAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const { error } = await supabase.rpc('revert_transaction_paid', {
      p_id: id,
      p_user_id: user.id
    })

    if (error) return error.message

    revalidatePath('/dashboard/fluxo')
    revalidatePath('/dashboard')
    return null
  } catch (err) {
    return (err as Error).message || "Erro ao reverter transação"
  }
}

export async function deleteLeaseAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    // Delega toda a lógica ACID e Invariante #1 para o Banco de Dados
    const { error } = await supabase.rpc('delete_lease_safe', {
      p_lease_id: id,
      p_user_id: user.id
    })

    if (error) return error.message

    revalidatePath('/dashboard/contratos')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/fluxo')
    return null
  } catch (err) {
    return (err as Error).message || "Erro ao deletar contrato"
  }
}

// INVARIANTE #1 — Cancelar transação (nunca deletar fisicamente)
export async function cancelTransactionAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    // A lógica de checagem da Invariante #8 foi movida para o Banco de Dados
    const { error } = await supabase.rpc('cancel_transaction_safe', {
      p_id: id,
      p_user_id: user.id
    })

    if (error) return error.message

    revalidatePath('/dashboard/fluxo')
    revalidatePath('/dashboard')
    return null
  } catch (err) {
    return (err as Error).message || "Erro ao cancelar transação"
  }
}

export async function getLeaseDocumentsAction(leaseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('lease_documents')
    .select('id, version, label, created_at, storage_path')
    .eq('lease_id', leaseId)
    .order('version', { ascending: false })
  return data ?? []
}

export async function getLeaseDocumentUrlAction(storagePath: string) {
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('lease-documents')
    .createSignedUrl(storagePath, 300) // 5 min
  return data?.signedUrl ?? null
}

export async function distratoAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const id = formData.get('id') as string
    const fineAmount = parseFloat(formData.get('fine_amount') as string)
    const propertyId = formData.get('property_id') as string
    const notes = formData.get('notes') as string || 'Multa rescisória / Distrato'

    if (isNaN(fineAmount) || fineAmount < 0) return "Valor da multa inválido."

    // 1. Marcar lease como inativo e definir end_date
    const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
    const { error: updateError } = await supabase.from('leases')
      .update({ active: false, end_date: todayStr })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) return updateError.message

    // 2. Se houver multa, criar transação manual de Income
    if (fineAmount > 0) {
      const { billingMonth, today } = await getUserBillingMonth(supabase, user.id)
      await supabase.from('transactions').insert({
        user_id: user.id,
        lease_id: id,
        property_id: propertyId,
        type: 'income',
        amount: fineAmount,
        due_date: today,
        billing_month: billingMonth,
        status: 'pending',
        notes: notes
      })
    }

    // 3. Auditoria Domain Event
    await supabase.from('domain_events').insert({
      user_id: user.id,
      event_type: 'contract_terminated',
      event_version: 1,
      source: 'user',
      payload: {
        entity_id: id,
        entity_type: 'lease',
        timestamp: new Date().toISOString(),
        context: { fine_amount: fineAmount, termination_date: todayStr }
      }
    })

    revalidatePath('/dashboard/contratos')
    revalidatePath('/dashboard/imoveis')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/fluxo')
    return null
  } catch (err) {
    return (err as Error).message || "Erro no processamento do distrato"
  }
}

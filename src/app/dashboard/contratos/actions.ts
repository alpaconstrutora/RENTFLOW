'use server'

import { createClient } from '../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateContratoPdfBuffer, buildContratoPdfData } from '../../../lib/pdf/generateContratoPdfBuffer'
import { formatBRL } from '../../../lib/valorPorExtenso'
import { getAdjustmentIndex } from '../../../lib/fiscal/indices'
import { getResend, FROM_EMAIL } from '../../../lib/email/client'
import Pizzip from 'pizzip'
import Docxtemplater from 'docxtemplater'

async function saveLeaseSnapshot(
  supabase: SupabaseClient,
  leaseId: string,
  userId: string,
  label: string
) {
  try {
    const [{ data: leaseFullRaw }, { data: propertyRaw }, { data: discountsRaw }, userRes] = await Promise.all([
      supabase.from('leases').select('code, rent_value, due_day, start_date, end_date, adjustment_index, adjustment_period_months, property_id, tenant_id, landlord_profile_id, guarantee_type, iptu_paid_by, condo_paid_by').eq('id', leaseId).single(),
      supabase.from('leases').select('properties(name, address, city, state, type)').eq('id', leaseId).single(),
      supabase.from('lease_discounts').select('start_installment, end_installment, discount_value').eq('lease_id', leaseId).order('start_installment', { ascending: true }),
      supabase.auth.getUser(),
    ])
    if (!leaseFullRaw) return

    const lease = {
      rent_value: leaseFullRaw.rent_value,
      due_day: leaseFullRaw.due_day,
      start_date: leaseFullRaw.start_date,
      end_date: leaseFullRaw.end_date,
      adjustment_index: leaseFullRaw.adjustment_index,
      adjustment_period_months: leaseFullRaw.adjustment_period_months,
      guarantee_type: leaseFullRaw.guarantee_type,
      iptu_paid_by: leaseFullRaw.iptu_paid_by,
      condo_paid_by: leaseFullRaw.condo_paid_by,
      code: leaseFullRaw.code,
    }

    const [{ data: tenantRaw }, { data: landlordProfileRaw }] = await Promise.all([
      supabase.from('tenants').select('name, document, email, phone, street, street_number, district, city, state, guarantor_name, guarantor_document').eq('id', leaseFullRaw.tenant_id).single(),
      leaseFullRaw.landlord_profile_id
        ? supabase.from('landlord_profiles').select('id, name, document, phone, address').eq('id', leaseFullRaw.landlord_profile_id).single()
        : supabase.from('landlord_profiles').select('id, name, document, phone, address').eq('user_id', userId).eq('is_default', true).maybeSingle(),
    ])

    const landlordProfileId = leaseFullRaw.landlord_profile_id || (landlordProfileRaw as { id?: string } | null)?.id || null
    let bankAccount = null
    if (landlordProfileId) {
      const { data: bankAccRaw } = await supabase
        .from('bank_accounts')
        .select('bank_name, bank_code, branch, branch_digit, account, account_digit, account_type, holder_name, holder_document, pix_key, pix_key_type')
        .eq('landlord_profile_id', landlordProfileId)
        .eq('is_main_account', true)
        .eq('is_active', true)
        .maybeSingle()
      bankAccount = bankAccRaw
    }

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
      discounts: discountsRaw ?? [],
      bankAccount: bankAccount as Parameters<typeof buildContratoPdfData>[0]['bankAccount']
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
    const guaranteeType      = (formData.get('guarantee_type')         as string) || 'nenhuma'
    const leaseDiscountsRaw  = (formData.get('lease_discounts_json')   as string) || '[]'

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
      guarantee_type:      guaranteeType,
      active: true
    }).select('id').single()

    if (error) return error.message

    // Salvar descontos
    const discounts = JSON.parse(leaseDiscountsRaw)
    if (discounts && discounts.length > 0) {
      const { error: discError } = await supabase.from('lease_discounts').insert(
        discounts.map((d: any) => ({
          lease_id: insertedLease.id,
          user_id: user.id,
          start_installment: parseInt(d.start_installment),
          end_installment: parseInt(d.end_installment),
          discount_value: parseFloat(d.discount_value)
        }))
      )
      if (discError) return discError.message
    }

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

      // Calcular o número da parcela correspondente a esse billingMonth
      const startMonthObj = new Date(effectiveBillingStart + 'T00:00:00Z')
      const currentMonthStartObj = new Date(billingMonth + 'T00:00:00Z')
      const diffMonths = (currentMonthStartObj.getUTCFullYear() - startMonthObj.getUTCFullYear()) * 12 + (currentMonthStartObj.getUTCMonth() - startMonthObj.getUTCMonth())
      const installmentNum = diffMonths + 1

      // Achar o desconto correspondente
      const matchedDiscount = discounts.find((d: any) => installmentNum >= d.start_installment && installmentNum <= d.end_installment)
      const discountAmount = matchedDiscount ? parseFloat(matchedDiscount.discount_value) : 0

      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        lease_id: insertedLease.id,
        property_id: propertyId,
        type: 'income',
        amount: rentValue,
        discount_amount: discountAmount,
        due_date: dueDate,
        billing_month: billingMonth, // C1: sempre dia 1 do mês
        status: 'pending'
      })
      if (txError) return `Erro ao gerar parcela do mês corrente: ${txError.message}`
    }

    // I1: Detectar retroativo com base em billing_start_date, não start_date
    const startDateObj = new Date(effectiveBillingStart + 'T00:00:00Z')
    
    // I10: domain_event contract_created — SEMPRE emitido, mesmo em retroativo
    const { error: eventError } = await supabase.rpc('log_domain_event', {
      p_event_type: 'contract_created',
      p_payload: {
        entity_id: insertedLease.id,
        entity_type: 'lease',
        timestamp: new Date().toISOString(),
        context: { start_date: startDate, rent_value: rentValue, property_id: propertyId, tenant_id: tenantId }
      }
    })
    if (eventError) return `Erro ao registrar evento de auditoria no banco: ${eventError.message}`

    // Calcular próximo reajuste automaticamente
    const { error: adjError } = await supabase.rpc('recalc_next_adjustment', { p_lease_id: insertedLease.id })
    if (adjError) return `Erro ao calcular reajuste automático inicial: ${adjError.message}`

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
    return { leaseId: insertedLease.id }
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

    console.log('[runBackfillAction] starting for lease:', leaseId, 'user:', user.id)
    const { data: count, error } = await supabase.rpc('backfill_lease_history', { p_lease_id: leaseId, p_user_id: user.id })
    console.log('[runBackfillAction] rpc result:', count, error)
    if (error) return error.message

    const { error: eventError } = await supabase.rpc('log_domain_event', {
      p_event_type: 'backfill_generated',
      p_payload: {
        entity_id: leaseId,
        entity_type: 'lease',
        timestamp: new Date().toISOString(),
        context: { lease_id: leaseId, months_count: count ?? 0 }
      }
    })
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
    const guaranteeType     = formData.has('guarantee_type')       ? (formData.get('guarantee_type')       as string) : undefined
    const propertyId        = formData.has('property_id')          ? (formData.get('property_id')          as string) : undefined
    const tenantId          = formData.has('tenant_id')            ? (formData.get('tenant_id')            as string) : undefined
    const startDate         = formData.has('start_date')           ? (formData.get('start_date')           as string) : undefined

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
    if (guaranteeType     !== undefined) updatePayload.guarantee_type      = guaranteeType
    if (propertyId        !== undefined) updatePayload.property_id         = propertyId
    if (tenantId          !== undefined) updatePayload.tenant_id           = tenantId
    if (startDate         !== undefined) updatePayload.start_date          = startDate

    const { error } = await supabase.from('leases')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message

    // Atualizar descontos se fornecido
    if (formData.has('lease_discounts_json')) {
      const leaseDiscountsRaw = formData.get('lease_discounts_json') as string || '[]'
      const discounts = JSON.parse(leaseDiscountsRaw)

      // Deletar anteriores
      const { error: delErr } = await supabase
        .from('lease_discounts')
        .delete()
        .eq('lease_id', id)

      if (delErr) return delErr.message

      // Inserir novos
      if (discounts.length > 0) {
        const { error: insErr } = await supabase.from('lease_discounts').insert(
          discounts.map((d: any) => ({
            lease_id: id,
            user_id: user.id,
            start_installment: parseInt(d.start_installment),
            end_installment: parseInt(d.end_installment),
            discount_value: parseFloat(d.discount_value)
          }))
        )
        if (insErr) return insErr.message
      }
    }

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

export async function getAdjustmentIndexAction(
  adjustmentIndex: string,
  periodMonths: number
) {
  if (adjustmentIndex !== 'IGPM' && adjustmentIndex !== 'IPCA') return null
  return getAdjustmentIndex(adjustmentIndex, periodMonths)
}

export async function getLeaseDocumentUrlAction(storagePath: string) {
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('lease-documents')
    .createSignedUrl(storagePath, 300) // 5 min
  return data?.signedUrl ?? null
}

export async function renewLeaseAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const id = formData.get('id') as string
    const newEndDate = formData.get('new_end_date') as string
    if (!newEndDate) return "Nova data de término obrigatória."

    const { error } = await supabase.from('leases')
      .update({ end_date: newEndDate, active: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message

    await Promise.all([
      supabase.rpc('log_domain_event', {
        p_event_type: 'contract_renewed',
        p_payload: {
          entity_id: id,
          entity_type: 'lease',
          timestamp: new Date().toISOString(),
          context: { new_end_date: newEndDate },
        },
      }),
      saveLeaseSnapshot(supabase, id, user.id, `Renovação — até ${new Date(newEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}`),
    ])

    revalidatePath('/dashboard/contratos')
    revalidatePath('/dashboard')
    return null
  } catch (err) {
    return (err as Error).message || "Erro ao renovar contrato"
  }
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
    await supabase.rpc('log_domain_event', {
      p_event_type: 'contract_terminated',
      p_payload: {
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

export async function sendContractEmailAction(leaseId: string): Promise<{ ok: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    const { data: leaseRaw } = await supabase
      .from('leases')
      .select('code, rent_value, due_day, start_date, end_date, adjustment_index, adjustment_period_months, property_id, tenant_id, landlord_profile_id, guarantee_type, iptu_paid_by, condo_paid_by')
      .eq('id', leaseId)
      .single()

    if (!leaseRaw) return { error: 'Contrato não encontrado' }

    const [{ data: propertyRaw }, { data: tenantRaw }, { data: landlordProfileRaw }, { data: discountsRaw }] = await Promise.all([
      supabase.from('properties').select('name, address, city, state, type').eq('id', leaseRaw.property_id).single(),
      supabase.from('tenants').select('name, document, email, phone, street, street_number, district, city, state, guarantor_name, guarantor_document').eq('id', leaseRaw.tenant_id).single(),
      leaseRaw.landlord_profile_id
        ? supabase.from('landlord_profiles').select('id, name, document, phone, address, email').eq('id', leaseRaw.landlord_profile_id).single()
        : supabase.from('landlord_profiles').select('id, name, document, phone, address, email').eq('user_id', user.id).eq('is_default', true).maybeSingle(),
      supabase.from('lease_discounts').select('start_installment, end_installment, discount_value').eq('lease_id', leaseId).order('start_installment', { ascending: true }),
    ])

    const landlordProfileId = leaseRaw.landlord_profile_id || (landlordProfileRaw as { id?: string } | null)?.id || null
    let bankAccount = null
    if (landlordProfileId) {
      const { data: bankAccRaw } = await supabase
        .from('bank_accounts')
        .select('bank_name, bank_code, branch, branch_digit, account, account_digit, account_type, holder_name, holder_document, pix_key, pix_key_type')
        .eq('landlord_profile_id', landlordProfileId)
        .eq('is_main_account', true)
        .eq('is_active', true)
        .maybeSingle()
      bankAccount = bankAccRaw
    }

    const tenant = tenantRaw as { name: string; email: string | null; document: string | null; phone: string | null; street: string | null; street_number: string | null; district: string | null; city: string | null; state: string | null; guarantor_name: string | null; guarantor_document: string | null } | null

    if (!tenant?.email) return { error: 'Inquilino sem e-mail cadastrado' }

    const ownerProfile = landlordProfileRaw as { name: string; document: string | null; phone: string | null; address: string | null; email?: string | null } | null
    const ownerEmail = ownerProfile?.email ?? user.email

    const pdfData = buildContratoPdfData({
      leaseId,
      lease: leaseRaw,
      property: propertyRaw as Parameters<typeof buildContratoPdfData>[0]['property'],
      tenant,
      owner: {
        name:     ownerProfile?.name     ?? user.email ?? '—',
        document: ownerProfile?.document ?? null,
        phone:    ownerProfile?.phone    ?? null,
        address:  ownerProfile?.address  ?? null,
      },
      discounts: discountsRaw ?? [],
      bankAccount: bankAccount as Parameters<typeof buildContratoPdfData>[0]['bankAccount']
    })

    const buffer = await generateContratoPdfBuffer(pdfData)
    const contractNum = leaseRaw.code ? String(leaseRaw.code).padStart(3, '0') : leaseId.split('-')[0].toUpperCase()
    const propertyName = (propertyRaw as { name: string } | null)?.name ?? 'imóvel'

    const resend = getResend()

    const toAddresses = [tenant.email]
    const ccAddresses = ownerEmail && ownerEmail !== tenant.email ? [ownerEmail] : []

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1a1a1a;">Contrato de Locação — ${propertyName}</h2>
        <p>Olá,</p>
        <p>Segue em anexo o contrato de locação referente ao imóvel <strong>${propertyName}</strong> (Ref. ${contractNum}).</p>
        <p>Por favor, revise o documento, assine as duas vias e devolva uma delas ao locador.</p>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          Este documento foi gerado eletronicamente pelo RentFlow.<br/>
          Não substitui assessoria jurídica especializada.
        </p>
      </div>
    `

    await resend.emails.send({
      from: FROM_EMAIL,
      to: toAddresses,
      cc: ccAddresses,
      subject: `Contrato de Locação — ${propertyName}`,
      html: emailBody,
      attachments: [
        {
          filename: `contrato-${contractNum.toLowerCase()}.pdf`,
          content: buffer,
        },
      ],
    })

    return { ok: true }
  } catch (err) {
    return { error: (err as Error).message || 'Erro ao enviar e-mail' }
  }
}

export async function getLeaseDiscountsAction(leaseId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('lease_discounts')
      .select('id, start_installment, end_installment, discount_value')
      .eq('lease_id', leaseId)
      .order('start_installment', { ascending: true })
    return data ?? []
  } catch {
    return []
  }
}

export async function getContractTemplatesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('contract_templates')
    .select('id, name, category, docx_storage_path, status, version, metadata, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createContractTemplateAction(
  name: string,
  category: string,
  docxStoragePath: string,
  variables: any[]
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const { data: template, error: tErr } = await supabase
      .from('contract_templates')
      .insert({
        user_id: user.id,
        name,
        category,
        docx_storage_path: docxStoragePath,
        status: 'active',
        version: '1.0.0'
      })
      .select('id')
      .single()

    if (tErr) return tErr.message

    if (variables && variables.length > 0) {
      const formattedVars = variables.map(v => ({
        template_id: template.id,
        code: v.code,
        label: v.label || v.code,
        field_type: v.field_type || 'text',
        is_required: v.is_required !== undefined ? v.is_required : true,
        origin: v.origin || 'manual',
        default_value: v.default_value || null,
        validation_regex: v.validation_regex || null,
        tooltip_help: v.tooltip_help || null
      }))

      const { error: vErr } = await supabase
        .from('contract_variables')
        .insert(formattedVars)

      if (vErr) {
        await supabase.from('contract_templates').delete().eq('id', template.id)
        return vErr.message
      }
    }

    revalidatePath('/dashboard/contratos')
    return { id: template.id }
  } catch (err: any) {
    return err.message || "Erro ao salvar template"
  }
}

export async function deleteContractTemplateAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const { count, error: countErr } = await supabase
      .from('contract_instances')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', id)

    if (countErr) return countErr.message
    if (count && count > 0) {
      return "Este modelo não pode ser deletado porque já foi utilizado na geração de contratos. Você pode arquivá-lo."
    }

    const { error } = await supabase
      .from('contract_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message

    revalidatePath('/dashboard/contratos')
    return null
  } catch (err: any) {
    return err.message || "Erro ao excluir template"
  }
}

export async function getTemplateVariablesAction(templateId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
      .from('contract_variables')
      .select('id, template_id, code, label, field_type, is_required, origin, default_value, validation_regex, tooltip_help')
      .eq('template_id', templateId)
      .order('code', { ascending: true })

    return data ?? []
  } catch {
    return []
  }
}

export async function uploadTemplateFileAction(fileName: string, base64Data: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Erro de Autenticação." }

    const buffer = Buffer.from(base64Data, 'base64')
    const fileExtension = fileName.split('.').pop()
    const storagePath = `${user.id}/templates/${Date.now()}_template.${fileExtension}`

    const { error } = await supabase.storage
      .from('lease-documents')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      })

    if (error) return { error: error.message }
    return { storagePath }
  } catch (err: any) {
    return { error: err.message || "Erro no upload do arquivo" }
  }
}

export async function generateContractInstanceAction(
  templateId: string,
  leaseId: string,
  variableValues: Record<string, string>
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Acesso não autorizado.")

    const { data: template } = await supabase
      .from('contract_templates')
      .select('docx_storage_path')
      .eq('id', templateId)
      .single()

    if (!template) throw new Error("Template não localizado.")

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lease-documents')
      .download(template.docx_storage_path)

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar template: ${downloadError?.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const zip = new Pizzip(arrayBuffer)
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    })

    doc.render(variableValues)

    const generatedZipBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    })

    const { data: lease } = await supabase
      .from('leases')
      .select('property_id, tenant_id')
      .eq('id', leaseId)
      .single()

    const { data: instance, error: instanceError } = await supabase
      .from('contract_instances')
      .insert({
        template_id: templateId,
        user_id: user.id,
        lease_id: leaseId,
        property_id: lease?.property_id || null,
        tenant_id: lease?.tenant_id || null,
        status: 'ready'
      })
      .select('id')
      .single()

    if (instanceError) throw new Error(instanceError.message)

    const docxPath = `${user.id}/leases/${leaseId}/${instance.id}_contrato.docx`
    const { error: uploadError } = await supabase.storage
      .from('lease-documents')
      .upload(docxPath, generatedZipBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Erro ao salvar arquivo DOCX no Storage: ${uploadError.message}`)
    }

    const pdfPath = `${user.id}/leases/${leaseId}/${instance.id}_contrato.pdf`
    const mockPdfBuffer = Buffer.from("PDF SIMULADO - MOTOR DE TEMPLATES JURIDICOS RENTFLOW")
    const { error: pdfUploadError } = await supabase.storage
      .from('lease-documents')
      .upload(pdfPath, mockPdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (pdfUploadError) {
      throw new Error(`Erro ao salvar arquivo PDF no Storage: ${pdfUploadError.message}`)
    }

    const crypto = await import('crypto')
    const sha256Hash = crypto.createHash('sha256').update(generatedZipBuffer).digest('hex')

    const { error: updateError } = await supabase
      .from('contract_instances')
      .update({
        generated_docx_path: docxPath,
        generated_pdf_path: pdfPath,
        sha256_hash: sha256Hash
      })
      .eq('id', instance.id)

    if (updateError) {
      throw new Error(`Erro ao atualizar os caminhos dos documentos gerados: ${updateError.message}`)
    }

    const { data: variables } = await supabase
      .from('contract_variables')
      .select('id, code')
      .eq('template_id', templateId)

    if (variables && variables.length > 0) {
      const valueEntries = variables
        .filter(v => variableValues[v.code] !== undefined)
        .map(v => ({
          instance_id: instance.id,
          variable_id: v.id,
          value: variableValues[v.code]
        }))

      if (valueEntries.length > 0) {
        const { error: insertVarsError } = await supabase
          .from('contract_variable_values')
          .insert(valueEntries)

        if (insertVarsError) {
          throw new Error(`Erro ao salvar os valores das variáveis no banco de dados: ${insertVarsError.message}`)
        }
      }
    }

    revalidatePath('/dashboard/contratos')
    return { success: true, instanceId: instance.id }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro na geração do contrato dinâmico" }
  }
}

/**
 * Busca o contrato ativo de um imóvel para auto-preenchimento no wizard de emissão.
 * Retorna null se não houver contrato ativo associado ao imóvel.
 */
export async function getActiveLeaseByPropertyAction(propertyId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('leases')
      .select(`
        id,
        rent_value,
        due_day,
        start_date,
        end_date,
        billing_start_date,
        adjustment_index,
        adjustment_period_months,
        landlord_profile_id,
        guarantee_type,
        iptu_paid_by,
        condo_paid_by,
        tenant_id,
        tenant:tenants(id, name, document, email, phone)
      `)
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return data ?? null
  } catch {
    return null
  }
}

export async function updateContractTemplateAction(
  id: string,
  name: string,
  category: string,
  docxStoragePath: string | null,
  variables: any[]
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "Erro de Autenticação."

    const updatePayload: Record<string, any> = { name, category }
    if (docxStoragePath) {
      updatePayload.docx_storage_path = docxStoragePath
    }

    const { error: tErr } = await supabase
      .from('contract_templates')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)

    if (tErr) return tErr.message

    const { error: dErr } = await supabase
      .from('contract_variables')
      .delete()
      .eq('template_id', id)

    if (dErr) return dErr.message

    if (variables && variables.length > 0) {
      const formattedVars = variables.map(v => ({
        template_id: id,
        code: v.code,
        label: v.label || v.code,
        field_type: v.field_type || 'text',
        is_required: v.is_required !== undefined ? v.is_required : true,
        origin: v.origin || 'manual',
        default_value: v.default_value || null,
        validation_regex: v.validation_regex || null,
        tooltip_help: v.tooltip_help || null
      }))

      const { error: vErr } = await supabase
        .from('contract_variables')
        .insert(formattedVars)

      if (vErr) return vErr.message
    }

    revalidatePath('/dashboard/contratos')
    return null
  } catch (err: any) {
    return err.message || "Erro ao atualizar template"
  }
}




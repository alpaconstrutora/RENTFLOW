'use server'

import { createClient } from '../../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  vencimentoPisCofins, vencimentoTrimestral,
  quarterOfMonth, quarterEndMonth, type Quarter,
} from '../../../../lib/fiscal/calendar'
import {
  PIS_RATE_DEFAULT, COFINS_RATE_DEFAULT, CSLL_RATE_DEFAULT, IRPJ_RATE_DEFAULT,
  PRESUMED_BASE_FACTOR_DEFAULT, IRPJ_ADICIONAL_RATE, IRPJ_ADICIONAL_THRESHOLD_QUARTER,
} from '../../../../lib/fiscal/rules'

export async function launchPjTaxesAction(year: number): Promise<{ count: number } | string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Erro de Autenticação.'

  const [{ data: pjConfig }, { data: incomeRaw }, { data: cats }] = await Promise.all([
    supabase.from('pj_tax_config').select('*').single(),
    supabase
      .from('transactions_view')
      .select('net_amount, amount, billing_month, property_id')
      .eq('type', 'income')
      .in('status', ['paid'])
      .gte('billing_month', `${year}-01-01`)
      .lte('billing_month', `${year}-12-31`),
    supabase
      .from('categories')
      .select('id, name')
      .eq('is_system', true)
      .in('name', ['PIS', 'COFINS', 'CSLL', 'IRPJ (Lucro Presumido)']),
  ])

  const pisRate    = pjConfig?.pis_rate             ?? PIS_RATE_DEFAULT
  const cofinsRate = pjConfig?.cofins_rate           ?? COFINS_RATE_DEFAULT
  const csllRate   = pjConfig?.csll_rate             ?? CSLL_RATE_DEFAULT
  const irpjRate   = pjConfig?.irpj_rate             ?? IRPJ_RATE_DEFAULT
  const base       = pjConfig?.presumed_base_factor  ?? PRESUMED_BASE_FACTOR_DEFAULT

  const catId: Record<string, string> = {}
  for (const c of cats ?? []) catId[c.name] = c.id

  // Agrupa receitas por (mês, imóvel) — cada imóvel terá seu lançamento proporcional
  // Isso evita depender de property_id nullable na tabela transactions.
  const byMonthProp: Record<string, Record<string, number>> = {}
  for (const t of incomeRaw ?? []) {
    const bm  = (t.billing_month as string).slice(0, 7)
    const pid = t.property_id as string
    if (!pid) continue
    if (!byMonthProp[bm]) byMonthProp[bm] = {}
    byMonthProp[bm][pid] = (byMonthProp[bm][pid] ?? 0) + Number(t.net_amount ?? t.amount)
  }

  // Cancela pendentes auto-gerados do ano (idempotência)
  const categoryIds = Object.values(catId)
  if (categoryIds.length > 0) {
    await supabase
      .from('transactions')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('is_auto_generated', true)
      .eq('status', 'pending')
      .in('category_id', categoryIds)
      .gte('billing_month', `${year}-01-01`)
      .lte('billing_month', `${year}-12-31`)
  }

  type TxInsert = Record<string, unknown>
  const toInsert: TxInsert[] = []

  // PIS / COFINS — mensal por imóvel
  for (const [bm, propMap] of Object.entries(byMonthProp)) {
    const monthTotal = Object.values(propMap).reduce((s, v) => s + v, 0)
    if (monthTotal <= 0) continue
    const dueDate      = vencimentoPisCofins(bm).toISOString().split('T')[0]
    const billingMonth = `${bm}-01`
    const label        = new Date(`${bm}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    for (const [pid, bruto] of Object.entries(propMap)) {
      if (catId['PIS']) toInsert.push({
        user_id: user.id, property_id: pid, category_id: catId['PIS'],
        type: 'expense', amount: Math.round(bruto * pisRate * 100) / 100,
        billing_month: billingMonth, due_date: dueDate,
        status: 'pending', is_auto_generated: true,
        notes: `PIS – Lucro Presumido – ${label}`,
      })
      if (catId['COFINS']) toInsert.push({
        user_id: user.id, property_id: pid, category_id: catId['COFINS'],
        type: 'expense', amount: Math.round(bruto * cofinsRate * 100) / 100,
        billing_month: billingMonth, due_date: dueDate,
        status: 'pending', is_auto_generated: true,
        notes: `COFINS – Lucro Presumido – ${label}`,
      })
    }
  }

  // CSLL / IRPJ — trimestral por imóvel (adicional distribuído proporcionalmente)
  type QRow = { year: number; q: Quarter; propMap: Record<string, number> }
  const quarterMap: Record<string, QRow> = {}
  for (const [bm, propMap] of Object.entries(byMonthProp)) {
    const [y2, m2] = bm.split('-').map(Number)
    const q   = quarterOfMonth(m2)
    const key = `${y2}-${q}`
    if (!quarterMap[key]) quarterMap[key] = { year: y2, q, propMap: {} }
    for (const [pid, amt] of Object.entries(propMap)) {
      quarterMap[key].propMap[pid] = (quarterMap[key].propMap[pid] ?? 0) + amt
    }
  }

  for (const { year: y2, q, propMap } of Object.values(quarterMap)) {
    const qTotal = Object.values(propMap).reduce((s, v) => s + v, 0)
    if (qTotal <= 0) continue
    const basePresumidaTotal = qTotal * base
    const adicionalTotal = Math.max(0, basePresumidaTotal - IRPJ_ADICIONAL_THRESHOLD_QUARTER) * IRPJ_ADICIONAL_RATE
    const dueDate      = vencimentoTrimestral(y2, q).toISOString().split('T')[0]
    const startMonth   = quarterEndMonth(q) - 2
    const billingMonth = `${y2}-${String(startMonth).padStart(2, '0')}-01`
    const label        = `${y2} ${q}`

    for (const [pid, bruto] of Object.entries(propMap)) {
      const share = qTotal > 0 ? bruto / qTotal : 0
      const csll      = Math.round(bruto * csllRate * 100) / 100
      const irpj      = Math.round(bruto * irpjRate * 100) / 100
      const adicional = Math.round(adicionalTotal * share * 100) / 100

      if (catId['CSLL']) toInsert.push({
        user_id: user.id, property_id: pid, category_id: catId['CSLL'],
        type: 'expense', amount: csll,
        billing_month: billingMonth, due_date: dueDate,
        status: 'pending', is_auto_generated: true,
        notes: `CSLL – Lucro Presumido – ${label}`,
      })
      if (catId['IRPJ (Lucro Presumido)']) toInsert.push({
        user_id: user.id, property_id: pid, category_id: catId['IRPJ (Lucro Presumido)'],
        type: 'expense', amount: irpj + adicional,
        billing_month: billingMonth, due_date: dueDate,
        status: 'pending', is_auto_generated: true,
        notes: `IRPJ – Lucro Presumido – ${label}${adicional > 0 ? ' (incl. adicional 10%)' : ''}`,
      })
    }
  }

  if (toInsert.length === 0) return { count: 0 }

  const { error } = await supabase.from('transactions').insert(toInsert)
  if (error) return error.message

  revalidatePath('/dashboard/fluxo')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/impostos/lucro-presumido')
  return { count: toInsert.length }
}

export async function savePjTaxConfigAction(formData: FormData): Promise<string | null> {
  const supabase = await createClient()

  const parse = (key: string) => parseFloat((formData.get(key) as string)?.replace(',', '.') || '0') / 100

  const pis    = parse('pis_rate')
  const cofins = parse('cofins_rate')
  const csll   = parse('csll_rate')
  const irpj   = parse('irpj_rate')
  const base   = parseFloat((formData.get('presumed_base_factor') as string)?.replace(',', '.') || '32') / 100

  const { error } = await supabase.rpc('upsert_pj_tax_config', {
    p_pis_rate:             pis,
    p_cofins_rate:          cofins,
    p_csll_rate:            csll,
    p_irpj_rate:            irpj,
    p_presumed_base_factor: base,
  })

  if (error) return error.message
  revalidatePath('/dashboard/impostos/lucro-presumido')
  return null
}

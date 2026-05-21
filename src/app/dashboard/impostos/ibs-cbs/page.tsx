import styles from '../../../page.module.css'
import { createClient } from '../../../../utils/supabase/server'
import TaxConfigForm from '../TaxConfigForm'
import YearFilter from '../YearFilter'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface SearchParams { ano?: string }

export default async function IbsCbsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedParams = await searchParams
  const supabase = await createClient()

  const { data: taxConfig } = await supabase
    .from('tax_config')
    .select('*')
    .single()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user?.id })
  const currentYearStr = ((todayStr as string) || new Date().toISOString()).split('-')[0]
  const currentYear   = parseInt(currentYearStr)

  const yr           = resolvedParams.ano || currentYearStr
  const startOfYear  = `${yr}-01-01`
  const endOfYear    = `${yr}-12-31`

  // Invariante #13 — leitura via transactions_view, nunca tabela direta
  const { data: ytdRents } = await supabase
    .from('transactions_view')
    .select('net_amount, amount, property_id')
    .eq('type', 'income')
    .in('status', ['paid', 'pending', 'late'])
    .gte('billing_month', startOfYear)
    .lte('billing_month', endOfYear)

  const { data: propertiesRaw } = await supabase.from('properties').select('id, type')
  const propTypeMap: Record<string, string> = {}
  for (const p of propertiesRaw ?? []) propTypeMap[p.id] = p.type

  let resTotalYtd = 0
  let comTotalYtd = 0
  for (const t of ytdRents || []) {
    const pType     = t.property_id ? (propTypeMap[t.property_id] ?? 'residential') : 'residential'
    const netAmount = Number(t.net_amount ?? t.amount)
    if (pType === 'residential') resTotalYtd += netAmount
    else comTotalYtd += netAmount
  }

  const baseRes  = resTotalYtd * (1 - (taxConfig?.residential_deduction || 0.50))
  const baseCom  = comTotalYtd
  const totalBase = baseRes + baseCom

  const ibsTotal = totalBase * (taxConfig?.ibs_rate || 0.0065)
  const cbsTotal = totalBase * (taxConfig?.cbs_rate || 0.0090)
  const totalTax = ibsTotal + cbsTotal

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <>
      <header className={styles.header}>
        <div>
          <Link
            href="/dashboard/impostos"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}
          >
            <ArrowLeft size={14} /> Tributos e Impostos
          </Link>
          <h1 className={styles.title}>IBS / CBS (Legado)</h1>
          <p className={styles.subtitle}>Estimativa de retenção automática sobre receitas de aluguel.</p>
        </div>
        <YearFilter selectedYear={parseInt(yr)} currentYear={currentYear} />
      </header>

      {/* Disclaimer */}
      <div style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.25)', padding: '20px 24px', borderRadius: '14px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '22px', flexShrink: 0 }}>⚠️</span>
        <div>
          <p style={{ color: '#FFB800', fontWeight: 600, margin: '0 0 6px', fontSize: '14px' }}>Disclaimer Tributário</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
            Estimativa baseada nas regras atuais do projeto de lei do IBS/CBS.{' '}
            <strong style={{ color: 'white' }}>Valores e alíquotas podem sofrer alterações.</strong>{' '}
            A base de cálculo usa o valor contratado — inadimplência não reduz a base. Para imóveis residenciais,
            aplica-se a dedução configurada.{' '}
            <strong style={{ color: 'white' }}>Consulte um contador antes de tomar decisões tributárias.</strong>
          </p>
        </div>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '800px' }}>
          <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '18px' }}>Como funciona</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Ao liquidar uma receita de aluguel no Fluxo de Caixa, o sistema calcula automaticamente a retenção de IBS + CBS.
            Para imóveis <strong style={{ color: 'white' }}>residenciais</strong>, aplica a dedução configurada (padrão 50%).
            Para <strong style={{ color: 'white' }}>comerciais</strong>, aplica a taxa integral.
            O resultado é lançado como despesa pendente.
          </p>
        </div>

        {/* Simulador YTD */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '800px' }}>
          <h3 style={{ color: 'white', marginBottom: '16px', fontSize: '18px' }}>
            Resumo Fiscal Anual — YTD {yr}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base de Cálculo (Res + Com)</p>
              <p style={{ color: 'white', fontSize: '20px', fontWeight: 600, margin: 0 }}>{fmt(totalBase)}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '4px 0 0' }}>
                Receitas brutas: {fmt(resTotalYtd + comTotalYtd)}
              </p>
            </div>
            <div style={{ background: 'rgba(255,10,10,0.05)', border: '1px solid rgba(255,10,10,0.1)', padding: '16px', borderRadius: '12px' }}>
              <p style={{ color: 'var(--danger-color)', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Carga Tributária Estimada</p>
              <p style={{ color: 'var(--danger-color)', fontSize: '20px', fontWeight: 600, margin: 0 }}>{fmt(totalTax)}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '4px 0 0' }}>
                IBS: {fmt(ibsTotal)} | CBS: {fmt(cbsTotal)}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <a
              href={`/dashboard/impostos/declaracao?ano=${yr}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--accent-color)', color: 'white', textDecoration: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
            >
              Extrato Contábil P/ IR
            </a>
          </div>
        </div>

        <TaxConfigForm initialConfig={taxConfig} />
      </section>
    </>
  )
}

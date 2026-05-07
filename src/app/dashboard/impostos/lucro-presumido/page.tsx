import styles from '../../../page.module.css'
import { createClient } from '../../../../utils/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import YearFilter from '../YearFilter'
import PjTaxConfigForm from './PjTaxConfigForm'
import QuarterParcelamento from './QuarterParcelamento'
import { vencimentoPisCofins, vencimentoTrimestral, quarterOfMonth, formatBR, type Quarter } from '../../../../lib/fiscal/calendar'
import {
  PIS_RATE_DEFAULT, COFINS_RATE_DEFAULT, CSLL_RATE_DEFAULT, IRPJ_RATE_DEFAULT,
  PRESUMED_BASE_FACTOR_DEFAULT,
} from '../../../../lib/fiscal/rules'
import FiscalDisclaimer from '../FiscalDisclaimer'
import { getSelicAnual, anualParaMensal, formatSelicAnual } from '../../../../lib/fiscal/selic'
import { calcParcelamento } from '../../../../lib/fiscal/parcelamento'

interface SearchParams { ano?: string }

export default async function LucroPresumidoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { ano } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user?.id })
  const currentYearStr = ((todayStr as string) || new Date().toISOString()).split('-')[0]
  const currentYear    = parseInt(currentYearStr)
  const yr             = ano || currentYearStr
  const startOfYear    = `${yr}-01-01`
  const endOfYear      = `${yr}-12-31`

  const { data: pjConfig } = await supabase
    .from('pj_tax_config')
    .select('*')
    .single()

  // Receitas brutas do ano (Invariante #13 — via transactions_view)
  const { data: incomeRaw } = await supabase
    .from('transactions_view')
    .select('net_amount, amount, billing_month, property_name')
    .eq('type', 'income')
    .in('status', ['paid'])
    .gte('billing_month', startOfYear)
    .lte('billing_month', endOfYear)

  const { value: selicAnual, source: selicSource } = await getSelicAnual()
  const selicMensal = anualParaMensal(selicAnual)

  const pisRate   = pjConfig?.pis_rate    ?? PIS_RATE_DEFAULT
  const cofinsRate= pjConfig?.cofins_rate ?? COFINS_RATE_DEFAULT
  const csllRate  = pjConfig?.csll_rate   ?? CSLL_RATE_DEFAULT
  const irpjRate  = pjConfig?.irpj_rate   ?? IRPJ_RATE_DEFAULT
  const base      = pjConfig?.presumed_base_factor ?? PRESUMED_BASE_FACTOR_DEFAULT

  // Agrupa receitas por mês de competência
  const byMonth: Record<string, number> = {}
  for (const t of incomeRaw ?? []) {
    const bm = (t.billing_month as string).slice(0, 7)
    byMonth[bm] = (byMonth[bm] ?? 0) + Number(t.net_amount ?? t.amount)
  }
  const months = Object.keys(byMonth).sort()

  // Linhas mensais para PIS/COFINS (apuração mensal, vence dia 25 com antecipação)
  const pisCofinsRows = months.map(bm => {
    const bruto = byMonth[bm]
    return {
      bm,
      bruto,
      pis:    bruto * pisRate,
      cofins: bruto * cofinsRate,
      total:  bruto * (pisRate + cofinsRate),
      due:    formatBR(vencimentoPisCofins(bm)),
    }
  })

  // Agrupa por trimestre para CSLL/IRPJ
  type QuarterRow = { quarter: Quarter; year: number; months: string[]; bruto: number; csll: number; irpj: number; total: number; due: string }
  const quarterMap: Record<string, QuarterRow> = {}
  for (const bm of months) {
    const [y2, m2] = bm.split('-').map(Number)
    const q = quarterOfMonth(m2)
    const key = `${y2}-${q}`
    if (!quarterMap[key]) {
      quarterMap[key] = {
        quarter: q, year: y2, months: [],
        bruto: 0, csll: 0, irpj: 0, total: 0,
        due: formatBR(vencimentoTrimestral(y2, q)),
      }
    }
    const v = byMonth[bm]
    quarterMap[key].months.push(bm)
    quarterMap[key].bruto += v
    quarterMap[key].csll  += v * csllRate
    quarterMap[key].irpj  += v * irpjRate
    quarterMap[key].total += v * (csllRate + irpjRate)
  }
  const quarterRows = Object.values(quarterMap)
    .sort((a, b) => `${a.year}-${a.quarter}`.localeCompare(`${b.year}-${b.quarter}`))
    .map(r => ({
      ...r,
      parcelamento2: calcParcelamento(r.total, r.year, r.quarter, 2, selicMensal, selicAnual),
      parcelamento3: calcParcelamento(r.total, r.year, r.quarter, 3, selicMensal, selicAnual),
    }))

  const totalBruto = months.reduce((s, bm) => s + byMonth[bm], 0)
  const pisTax     = totalBruto * pisRate
  const cofinsTax  = totalBruto * cofinsRate
  const csllFinal  = totalBruto * csllRate
  const irpjFinal  = totalBruto * irpjRate
  const totalTax   = pisTax + cofinsTax + csllFinal + irpjFinal

  const fmt    = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`

  const tributos = [
    { label: 'PIS',    color: '#f472b6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.2)', value: pisTax,    rate: pisRate,    desc: 'receita bruta' },
    { label: 'COFINS', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', value: cofinsTax, rate: cofinsRate, desc: 'receita bruta' },
    { label: 'CSLL',   color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)',  value: csllFinal, rate: csllRate,   desc: `equiv. 9%×${fmtPct(base)}` },
    { label: 'IRPJ',   color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)',  value: irpjFinal, rate: irpjRate,   desc: `equiv. 15%×${fmtPct(base)}` },
  ]

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
          <h1 className={styles.title}>Lucro Presumido — PJ</h1>
          <p className={styles.subtitle}>Estimativa de PIS, COFINS, CSLL e IRPJ sobre receitas de aluguel.</p>
        </div>
        <YearFilter selectedYear={parseInt(yr)} currentYear={currentYear} />
      </header>

      <FiscalDisclaimer
        regime="lucro_presumido"
        includesDARF
        includesBusinessDayCalc
      />

      {/* Badges de vencimento */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(244,114,182,0.07)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '10px' }}>
          <span style={{ fontSize: '11px', color: '#f472b6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PIS · COFINS</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>Mensal — dia 25 do mês seguinte</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: '10px' }}>
          <span style={{ fontSize: '11px', color: '#fb923c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CSLL · IRPJ</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>Trimestral — último dia útil após o trimestre</span>
        </div>
      </div>

      {/* Cards por tributo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', maxWidth: '800px' }}>
        {tributos.map(t => (
          <div key={t.label} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '18px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: t.color, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.label}</p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: t.color, margin: '0 0 4px' }}>{fmt(t.value)}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              {fmtPct(t.rate)} s/ {t.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Resumo YTD */}
      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', maxWidth: '800px' }}>
        <h3 style={{ color: 'white', marginBottom: '16px', fontSize: '17px' }}>Resumo Fiscal — YTD {yr}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receita Bruta YTD</p>
            <p style={{ color: 'white', fontSize: '22px', fontWeight: 600, margin: 0 }}>{fmt(totalBruto)}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '4px 0 0' }}>Lucro presumido: {fmt(totalBruto * base)}</p>
          </div>
          <div style={{ background: 'rgba(255,10,10,0.05)', border: '1px solid rgba(255,10,10,0.1)', padding: '16px', borderRadius: '12px' }}>
            <p style={{ color: 'var(--danger-color)', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Carga Tributária Total</p>
            <p style={{ color: 'var(--danger-color)', fontSize: '22px', fontWeight: 600, margin: 0 }}>{fmt(totalTax)}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '4px 0 0' }}>
              {fmtPct(totalBruto > 0 ? totalTax / totalBruto : 0)} da receita bruta
            </p>
          </div>
        </div>

        {/* Detalhamento por tributo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: pisCofinsRows.length > 0 || quarterRows.length > 0 ? '20px' : 0 }}>
          {tributos.map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: t.color, fontWeight: 600, width: '70px' }}>{t.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>alíq. efetiva {fmtPct(t.rate)}</span>
              <span style={{ fontSize: '14px', color: 'white', fontWeight: 500 }}>{fmt(t.value)}</span>
            </div>
          ))}
        </div>

        {/* Tabela PIS/COFINS — mensal, dia 25 */}
        {pisCofinsRows.length > 0 && (
          <>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', fontWeight: 600 }}>
              PIS / COFINS — Mensal (dia 25, antecipa para dia útil anterior)
            </p>
            <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Competência', 'Receita Bruta', 'PIS', 'COFINS', 'Total', 'Vencimento'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500, textAlign: h === 'Competência' || h === 'Vencimento' ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pisCofinsRows.map(r => (
                    <tr key={r.bm} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
                        {new Date(r.bm + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', textAlign: 'right' }}>{fmt(r.bruto)}</td>
                      <td style={{ padding: '7px 10px', color: '#f472b6', textAlign: 'right' }}>{fmt(r.pis)}</td>
                      <td style={{ padding: '7px 10px', color: '#a78bfa', textAlign: 'right' }}>{fmt(r.cofins)}</td>
                      <td style={{ padding: '7px 10px', color: 'white', fontWeight: 600, textAlign: 'right' }}>{fmt(r.total)}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tabela CSLL/IRPJ — trimestral com parcelamento */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: 0 }}>
                CSLL / IRPJ — Trimestral (último dia útil após o trimestre)
              </p>
              <span style={{ fontSize: '11px', color: selicSource === 'bacen' ? 'var(--text-muted)' : '#fb923c' }}>
                Selic {formatSelicAnual(selicAnual)}{selicSource === 'fallback' ? ' (estimativa)' : ' · BACEN'}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Trimestre', 'Receita Bruta', 'CSLL', 'IRPJ', 'Total', 'Vencimento / Parcelar'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500, textAlign: h === 'Trimestre' || h.startsWith('Venc') ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quarterRows.map(r => (
                    <QuarterParcelamento
                      key={`${r.year}-${r.quarter}`}
                      quarter={r.quarter}
                      year={r.year}
                      bruto={r.bruto}
                      csll={r.csll}
                      irpj={r.irpj}
                      total={r.total}
                      due={r.due}
                      months={r.months}
                      parcelamento2={r.parcelamento2}
                      parcelamento3={r.parcelamento3}
                      selicAnual={selicAnual}
                      fmt={fmt}
                      fmtPct={fmtPct}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <PjTaxConfigForm config={pjConfig} />
    </>
  )
}

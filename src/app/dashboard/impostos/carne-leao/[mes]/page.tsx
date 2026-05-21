import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import styles from '../../../../../app/page.module.css'
import { createClient } from '../../../../../utils/supabase/server'
import MonthNav from './MonthNav'
import IrrfInput from './IrrfInput'
import RecalcBtn from './RecalcBtn'
import { vencimentoCarneLeao } from '../../../../../lib/fiscal/calendar'
import { formatBR } from '../../../../../lib/fiscal/business-day'
import FiscalDisclaimer from '../../FiscalDisclaimer'

export default async function CarneLeaoMesPage({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params

  if (!/^\d{4}-\d{2}$/.test(mes)) redirect('/dashboard/impostos')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
  const currentMes = ((todayStr as string) || new Date().toISOString()).slice(0, 7)

  const [y, m] = mes.split('-').map(Number)
  const startOfMonth = `${mes}-01`
  const nextMonthDate = new Date(y, m, 1)
  const startOfNext   = nextMonthDate.toISOString().split('T')[0]

  // ── Dados do mês ────────────────────────────────────────────────

  // Receitas pagas no mês (regime de caixa: paid_date no mês)
  const { data: incomeRaw } = await supabase
    .from('transactions_view')
    .select('id, amount, net_amount, discount_amount, addition_amount, withheld_irrf, property_name, paid_date, billing_month, notes')
    .eq('type', 'income')
    .eq('status', 'paid')
    .gte('paid_date', startOfMonth)
    .lt('paid_date',  startOfNext)
    .order('paid_date', { ascending: false })

  // Despesas pagas no mês (para deduções)
  const { data: expensesRaw } = await supabase
    .from('transactions_view')
    .select('id, amount, net_amount, discount_amount, addition_amount, category_id, property_name, paid_date')
    .eq('type', 'expense')
    .eq('status', 'paid')
    .gte('paid_date', startOfMonth)
    .lt('paid_date',  startOfNext)

  // Categorias dedutíveis
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, tax_category')

  const deductibleCatIds = new Set(
    (categories ?? [])
      .filter(c => ['iptu','condo','admin_fee','commission','maintenance'].includes(c.tax_category ?? ''))
      .map(c => c.id)
  )
  const catMap = Object.fromEntries((categories ?? []).map(c => [c.id, c]))

  const deductibleExpenses = (expensesRaw ?? []).filter(e => deductibleCatIds.has(e.category_id))

  // Lançamento IRPF auto-gerado para o mês (billing_month = mês)
  const { data: irpfTx } = await supabase
    .from('transactions_view')
    .select('id, amount, due_date, status, notes')
    .eq('type', 'expense')
    .eq('billing_month', startOfMonth)
    .eq('is_auto_generated', true)
    .ilike('notes', '%Carnê-leão IRPF%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Cálculos ────────────────────────────────────────────────────

  const income       = incomeRaw ?? []
  const totalGross   = income.reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0)
  const totalWirrf   = income.reduce((s, t) => s + Number(t.withheld_irrf ?? 0), 0)
  const totalDeduct  = deductibleExpenses.reduce((s, e) => s + Number(e.net_amount ?? e.amount), 0)
  const netBase      = Math.max(0, totalGross - totalDeduct)

  // Faixa aplicada (informativo — o cálculo real está na RPC)
  const { data: brackets } = await supabase
    .from('irpf_brackets')
    .select('min_income, max_income, rate, deduction')
    .lte('effective_from', startOfMonth)
    .order('effective_from', { ascending: false })
    .order('min_income', { ascending: true })

  const bracket = (brackets ?? []).find(b =>
    netBase >= Number(b.min_income) && (b.max_income === null || netBase <= Number(b.max_income))
  )
  const rate       = bracket ? Number(bracket.rate) : 0
  const taxGross   = bracket ? Math.max(0, netBase * rate - Number(bracket.deduction)) : 0
  const toPay      = Math.max(0, taxGross - totalWirrf)

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const fmtDate = (d: string) => { const [yy, mm, dd] = d.split('T')[0].split('-'); return `${dd}/${mm}/${yy}` }
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Vencimento do DARF Carnê-Leão: último dia útil do mês seguinte (com antecipação)
  const darfDueDate = vencimentoCarneLeao(mes)
  const darfDueFmt  = formatBR(darfDueDate)

  // ── Estilos reutilizáveis ───────────────────────────────────────
  const card = (accent?: string): React.CSSProperties => ({
    background: accent ? `rgba(${accent},0.06)` : 'rgba(0,0,0,0.25)',
    border: `1px solid ${accent ? `rgba(${accent},0.2)` : 'rgba(255,255,255,0.05)'}`,
    borderRadius: '14px', padding: '20px 24px',
  })

  const tHead: React.CSSProperties = {
    fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.05em', padding: '10px 14px', textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  }

  const tCell: React.CSSProperties = {
    padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  }

  return (
    <>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard/impostos" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
            <ArrowLeft size={14} /> Tributos e Impostos
          </Link>
          <h1 className={styles.title}>Carnê-Leão IRPF</h1>
          <p className={styles.subtitle}>Apuração mensal — regime de caixa</p>
        </div>
        <MonthNav mes={mes} currentMes={currentMes} />
      </header>

      <FiscalDisclaimer
        regime="carneleao"
        includesIRRF
        includesDARF
        includesBusinessDayCalc
      />

      {/* Lançamento IRPF existente */}
      {irpfTx && (
        <div style={{ ...card('99,200,100'), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>
              Carnê-leão calculado: {fmt(Number(irpfTx.amount))}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
              Vence em {irpfTx.due_date ? fmtDate(irpfTx.due_date) : '—'} — gere o DARF no site da RFB (SICALC)
            </p>
          </div>
          <span style={{ fontSize: '11px', background: 'rgba(74,222,128,0.12)', color: '#4ade80', padding: '4px 10px', borderRadius: '20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pendente
          </span>
        </div>
      )}

      {/* Cards sumário */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Receitas Brutas', value: fmt(totalGross), sub: `${income.length} recebimento(s)`, accent: '74,222,128' },
          { label: 'Deduções', value: fmt(totalDeduct), sub: `${deductibleExpenses.length} despesa(s)`, accent: '147,197,253' },
          { label: 'Base de Cálculo', value: fmt(netBase), sub: netBase === 0 ? 'isento' : `faixa ${(rate * 100).toFixed(1)}%` },
          { label: 'IRRF já Retido', value: fmt(totalWirrf), sub: 'retido na fonte', accent: '251,191,36' },
          { label: 'A Recolher (DARF)', value: fmt(toPay), sub: toPay === 0 ? (income.length === 0 ? 'sem receitas' : 'isento / coberto pelo IRRF') : `alíq. efetiva ${netBase > 0 ? (toPay / netBase * 100).toFixed(1) : 0}%`, accent: toPay > 0 ? '248,113,113' : undefined },
        ].map(c => (
          <div key={c.label} style={card(c.accent)}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</p>
            <p style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: c.accent ? `rgb(${c.accent})` : 'white' }}>{c.value}</p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Vencimento DARF */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', maxWidth: 'max-content' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>DARF — Pago pelo contribuinte PF</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>·</span>
        <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>Vence: {darfDueFmt}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '20px' }}>
          último dia útil do mês seguinte
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <RecalcBtn billingMonth={mes} />
        {income.length === 0 && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={14} /> Nenhuma receita com <code style={{ fontSize: '12px', background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>paid_date</code> neste mês.
          </span>
        )}
      </div>

      {/* Tabela receitas */}
      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: 600 }}>Receitas do Mês (pagas)</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>IRRF retido na fonte — editável por linha</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Imóvel', 'Data Pagto', 'Valor Líquido', 'IRRF Retido (R$)', 'Obs'].map(h => (
                <th key={h} style={tHead}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {income.length === 0 && (
              <tr><td colSpan={5} style={{ ...tCell, textAlign: 'center', padding: '28px' }}>Nenhuma receita liquidada neste mês.</td></tr>
            )}
            {income.map(t => (
              <tr key={t.id}>
                <td style={{ ...tCell, color: 'white', fontWeight: 500 }}>{t.property_name ?? '—'}</td>
                <td style={tCell}>{t.paid_date ? fmtDate(t.paid_date) : '—'}</td>
                <td style={{ ...tCell, color: '#4ade80' }}>{fmt(Number(t.net_amount ?? t.amount))}</td>
                <td style={tCell}>
                  <IrrfInput
                    transactionId={t.id}
                    billingMonth={mes}
                    currentValue={Number(t.withheld_irrf ?? 0)}
                  />
                </td>
                <td style={{ ...tCell, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                  {t.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabela deduções */}
      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: 600 }}>Deduções Consideradas</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Despesas pagas neste mês com categoria dedutível (IPTU, Condomínio, Taxa adm., Comissão, Manutenção).
          </p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Categoria', 'Imóvel', 'Data Pagto', 'Valor'].map(h => (
                <th key={h} style={tHead}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deductibleExpenses.length === 0 && (
              <tr><td colSpan={4} style={{ ...tCell, textAlign: 'center', padding: '28px' }}>Nenhuma despesa dedutível paga neste mês.</td></tr>
            )}
            {deductibleExpenses.map(e => (
              <tr key={e.id}>
                <td style={{ ...tCell, color: 'white' }}>{catMap[e.category_id]?.name ?? '—'}</td>
                <td style={tCell}>{e.property_name ?? '—'}</td>
                <td style={tCell}>{e.paid_date ? fmtDate(e.paid_date) : '—'}</td>
                <td style={{ ...tCell, color: '#f87171' }}>({fmt(Number(e.net_amount ?? e.amount))})</td>
              </tr>
            ))}
            {deductibleExpenses.length > 0 && (
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <td colSpan={3} style={{ ...tCell, color: 'var(--text-secondary)', fontWeight: 600 }}>Total deduções</td>
                <td style={{ ...tCell, color: '#93c5fd', fontWeight: 600 }}>({fmt(totalDeduct)})</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Memória de cálculo */}
      {income.length > 0 && (
        <div style={{ ...card(), fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 2 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'white' }}>Memória de Cálculo</p>
          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div>Receita bruta (caixa):&nbsp;&nbsp;&nbsp;&nbsp;{fmt(totalGross)}</div>
            <div>( - ) Deduções:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{fmt(totalDeduct)}</div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px', paddingTop: '4px' }}>
              Base de cálculo líquida:&nbsp;&nbsp;{fmt(netBase)}
            </div>
            <div>Alíquota:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{(rate * 100).toFixed(1)}%</div>
            {bracket && <div>( - ) Parcela a deduzir:&nbsp;&nbsp;&nbsp;{fmt(Number(bracket.deduction))}</div>}
            <div>Imposto bruto:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{fmt(taxGross)}</div>
            <div>( - ) IRRF retido:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{fmt(totalWirrf)}</div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px', paddingTop: '4px', color: toPay > 0 ? '#f87171' : '#4ade80', fontWeight: 700 }}>
              DARF a recolher:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{fmt(toPay)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

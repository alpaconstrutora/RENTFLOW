import {
  Building2, Wallet, TrendingUp, Activity,
  ArrowUpRight, ArrowDownRight, AlertTriangle,
  DoorOpen, Clock, CalendarX, Trophy, Bell
} from 'lucide-react'
import { redirect } from 'next/navigation'
import styles from '../page.module.css'
import { createClient } from '../../utils/supabase/server'
import { getCurrentUserId } from '../../utils/supabase/user'
import { startTimer, formatTimings, timeIt } from '../../utils/perf-debug'

export default async function Dashboard() {
  const timer = startTimer()

  const userId = await getCurrentUserId()
  timer.mark('getCurrentUserId')
  if (!userId) redirect('/login')

  const supabase = await createClient()
  timer.mark('createClient')

  // Compute today in BR timezone locally — no extra round-trip needed
  const today = new Date().toLocaleString('sv', { timeZone: 'America/Sao_Paulo' }).split(' ')[0]
  const [yr, mo] = today.split('-').map(Number)
  const startOfMonth = `${yr}-${String(mo).padStart(2, '0')}-01`
  const startOfYear  = `${yr}-01-01`

  const todayDate = new Date(today + 'T00:00:00Z')
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setUTCDate(d.getUTCDate() + n); return r.toISOString().split('T')[0] }
  const day7Str    = addDays(todayDate,   7)
  const day30Str   = addDays(todayDate,  30)
  const day30AgoStr= addDays(todayDate, -30)
  const d365AgoStr = addDays(todayDate,-365)

  // All 16 queries in one parallel round-trip — instrumentadas para timing individual
  const queryResults = await Promise.all([
    timeIt('q1_inc_month',    supabase.from('transactions_view').select('net_amount').eq('type','income').eq('status','paid').gte('billing_month', startOfMonth)),
    timeIt('q2_exp_month',    supabase.from('transactions_view').select('net_amount').eq('type','expense').eq('status','paid').gte('billing_month', startOfMonth)),
    timeIt('q3_inc_ytd',      supabase.from('transactions_view').select('net_amount').eq('type','income').eq('status','paid').gte('billing_month', startOfYear)),
    timeIt('q4_exp_ytd',      supabase.from('transactions_view').select('net_amount').eq('type','expense').eq('status','paid').gte('billing_month', startOfYear)),
    timeIt('q5_late_inc',     supabase.from('transactions_view').select('amount').eq('type','income').eq('status','late').gte('billing_month', startOfMonth)),
    timeIt('q6_expected_inc', supabase.from('transactions_view').select('amount').eq('type','income').in('status',['pending','paid','late']).gte('billing_month', startOfMonth)),
    timeIt('q7_late_30d',     supabase.from('transactions_view').select('amount').eq('type','income').eq('status','late').gte('due_date', day30AgoStr).lte('due_date', today)),
    timeIt('q8_exp_30d',      supabase.from('transactions_view').select('amount').eq('type','income').in('status',['pending','paid','late']).gte('due_date', day30AgoStr).lte('due_date', today)),
    timeIt('q9_paid_hist',    supabase.from('transactions_view').select('paid_date, due_date').eq('type','income').eq('status','paid').not('paid_date','is',null).gte('paid_date', d365AgoStr)),
    timeIt('q10_total_props', supabase.from('properties').select('*', { count: 'exact', head: true })),
    timeIt('q11_rented',      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status','rented')),
    timeIt('q12_venc_7d',     supabase.from('transactions_view').select('id, amount, due_date, type, property_id').in('status',['pending','late']).gte('due_date', today).lte('due_date', day7Str).order('due_date')),
    timeIt('q13_expiring',    supabase.from('leases').select('id, end_date, rent_value, property:properties(name)').eq('active',true).not('end_date','is',null).gte('end_date', today).lte('end_date', day30Str).order('end_date')),
    timeIt('q14_allProps',    supabase.from('properties').select('id, name, purchase_value, leases!inner(rent_value, active)').gt('purchase_value',0).eq('leases.active',true)),
    timeIt('q15_alerts_rpc',  supabase.rpc('get_lease_alerts', { p_user_id: userId })),
    timeIt('q16_billing_rpc', supabase.rpc('get_last_billing_status')),
  ])
  timer.mark('16 queries (Promise.all)')

  // Extrai os results na ordem
  const [
    { result: { data: incomes } },
    { result: { data: expenses } },
    { result: { data: incomesYtd } },
    { result: { data: expensesYtd } },
    { result: { data: lateInc } },
    { result: { data: expectedInc } },
    { result: { data: lateRolling } },
    { result: { data: expRolling } },
    { result: { data: paidHist } },
    { result: { count: totalProps } },
    { result: { count: rentedProps } },
    { result: { data: vencD7 } },
    { result: { data: expiringLeasesRaw } },
    { result: { data: allProps } },
    { result: { data: leaseAlerts } },
    { result: { data: billingStatus } },
  ] = queryResults

  // Ordena timings das queries por duração (mais lenta primeiro) pra debug
  const querTimings = [...queryResults]
    .sort((a, b) => b.ms - a.ms)
    .map((r) => `${r.label}=${r.ms}ms`)
    .join(' · ')

  const region = process.env.VERCEL_REGION ?? 'unknown'
  const perfReport = `region=${region} · ${formatTimings(timer.records)}`

  // ── KPI 1
  const totalIncome  = incomes?.reduce((s, t) => s + Number(t.net_amount), 0) || 0
  const totalExpense = expenses?.reduce((s, t) => s + Number(t.net_amount), 0) || 0
  const netProfit    = totalIncome - totalExpense

  const totalIncomeYtd  = incomesYtd?.reduce((s, t) => s + Number(t.net_amount), 0) || 0
  const totalExpenseYtd = expensesYtd?.reduce((s, t) => s + Number(t.net_amount), 0) || 0
  const netProfitYtd    = totalIncomeYtd - totalExpenseYtd

  // ── KPI 2
  const totalLate     = lateInc?.reduce((s, t) => s + Number(t.amount), 0) || 0
  const totalExpected = expectedInc?.reduce((s, t) => s + Number(t.amount), 0) || 0
  const inadimplenciaPct = totalExpected > 0 ? ((totalLate / totalExpected) * 100).toFixed(1) : '0.0'

  // ── KPI 3
  const lateR = lateRolling?.reduce((s, t) => s + Number(t.amount), 0) || 0
  const expR  = expRolling?.reduce((s, t) => s + Number(t.amount), 0) || 0
  const rolling30Pct = expR > 0 ? ((lateR / expR) * 100).toFixed(1) : '0.0'

  // ── TMR
  let tmrDaysTotal = 0, tmrCount = 0
  for (const t of paidHist || []) {
    const diff = Math.ceil((new Date(t.paid_date + 'T12:00:00Z').getTime() - new Date(t.due_date + 'T12:00:00Z').getTime()) / 86400000)
    if (diff > 0) { tmrDaysTotal += diff; tmrCount++ }
  }
  const tmrAvg = tmrCount > 0 ? (tmrDaysTotal / tmrCount).toFixed(1) : '0.0'

  // ── KPI 4
  const vacancyRate = totalProps && totalProps > 0 ? (((totalProps - (rentedProps || 0)) / totalProps) * 100).toFixed(1) : '0.0'

  // ── I3 types
  const expiringLeases = expiringLeasesRaw as { id: string; end_date: string; rent_value: number; property: { name: string } | null }[] | null

  // ── Top 3 Yield
  const top3Yield = (allProps || [])
    .map((p) => {
      const leases = p.leases as { rent_value: number; active: boolean }[]
      const rent = leases?.filter(l => l.active)[0]?.rent_value ?? 0
      const pv = p.purchase_value as number
      const yld = pv > 0 ? (rent * 12 / pv * 100) : null
      return { name: p.name as string, yield: yld }
    })
    .filter(p => p.yield !== null)
    .sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0))
    .slice(0, 3)
  const lastBilling = (billingStatus as { status: string; error_message: string | null; rows_affected: number | null; run_at: string }[] | null)?.[0] ?? null
  const leaseAlertsData = (leaseAlerts as {
    lease_id: string; property_name: string; tenant_name: string;
    alert_type: string; alert_date: string; days_remaining: number; adjustment_index: string
  }[] | null) || []

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDate = (d: string) => { const [y, m, dd] = d.split('T')[0].split('-'); return `${dd}/${m}/${y}` }
  const now = new Date(today + 'T12:00:00Z')

  return (
    <>
      {/* DEBUG TIMING — remover após diagnóstico */}
      <div style={{ background: '#1e1b4b', border: '1px solid #6366f1', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '11px', fontFamily: 'monospace', color: '#c7d2fe' }}>
        <div>⏱ {perfReport}</div>
        <div style={{ marginTop: '4px', color: '#a5b4fc' }}>queries ordenadas por duração: {querTimings}</div>
      </div>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard Financeiro</h1>
          <p className={styles.subtitle}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} · Competência: {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className={styles.btnPrimary} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'white', boxShadow: 'none' }}>Sair</button>
        </form>
      </header>

      {/* ── LINHA 1: DRE DO MÊS */}
      <h2 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
        <span>
          <Activity size={14} style={{ display: 'inline', marginRight: '8px' }} />
          Resultado do Mês
        </span>
      </h2>
      <div className={styles.gridCards} style={{ marginBottom: '32px' }}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Lucro Real (DRE)</span>
            <div className={`${styles.iconWrapper} ${styles.iconIncome}`} style={{ background: 'rgba(255,255,255,0.08)' }}><Wallet size={20} color="white" /></div>
          </div>
          <span className={styles.cardValue} style={{ color: netProfit >= 0 ? 'white' : 'var(--danger-color)' }}>{formatBRL(netProfit)}</span>
          <div className={styles.cardLabel}>Receitas pagas menos despesas do mês</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Receitas Recebidas</span>
            <div className={`${styles.iconWrapper} ${styles.iconIncome}`}><TrendingUp size={20} /></div>
          </div>
          <span className={styles.cardValue}>{formatBRL(totalIncome)}</span>
          <div className={styles.cardLabel}><ArrowUpRight size={14} className={styles.trendUp} style={{ display: 'inline' }} /> Caixa bruto do mês</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Despesas / Tributos</span>
            <div className={`${styles.iconWrapper} ${styles.iconExpense}`}><ArrowDownRight size={20} color="var(--danger-color)" /></div>
          </div>
          <span className={styles.cardValue} style={{ color: 'var(--danger-color)' }}>{formatBRL(totalExpense)}</span>
          <div className={styles.cardLabel}>Saídas e retenções tributárias</div>
        </div>
      </div>

      {/* ── LINHA 1.5: PERFORMANCE ANUAL (YTD) E CICLO */}
      <h2 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Trophy size={14} style={{ display: 'inline', marginRight: '8px' }} color="var(--accent-color)" />
        Performance Anual e Ciclo ({yr})
      </h2>
      <div className={styles.gridCards} style={{ marginBottom: '32px' }}>
        <div className={styles.card} style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.03)' }}>
          <div className={styles.cardHeader}>
            <span>Lucro Acumulado (YTD)</span>
            <div className={styles.iconWrapper} style={{ background: 'var(--accent-color)' }}><Wallet size={20} color="white" /></div>
          </div>
          <span className={styles.cardValue} style={{ color: netProfitYtd >= 0 ? 'var(--accent-color)' : 'var(--danger-color)', fontSize: '28px' }}>{formatBRL(netProfitYtd)}</span>
          <div className={styles.cardLabel} style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--success-color)' }}>Rec: {formatBRL(totalIncomeYtd)}</span>
            <span style={{ color: 'var(--danger-color)' }}>Desp: {formatBRL(totalExpenseYtd)}</span>
          </div>
        </div>

        <div className={styles.card} style={{ border: '1px solid var(--border-color)' }}>
          <div className={styles.cardHeader}>
            <span>Tempo Médio Recebimento</span>
            <div className={styles.iconWrapper} style={{ background: 'rgba(255,255,255,0.05)' }}><Activity size={20} color="var(--text-muted)" /></div>
          </div>
          <span className={styles.cardValue} style={{ color: Number(tmrAvg) > 5 ? 'var(--warning-color)' : 'var(--success-color)', fontSize: '28px' }}>
            {tmrAvg} <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>dias</span>
          </span>
          <div className={styles.cardLabel}>Média de atraso nas faturas (12m)</div>
        </div>
      </div>

      {/* ── LINHA 2: RISCOS E OCUPAÇÃO */}
      <h2 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <AlertTriangle size={14} style={{ display: 'inline', marginRight: '8px' }} color="var(--warning-color)" />
        Risco e Ocupação
      </h2>
      <div className={styles.gridCards} style={{ marginBottom: '32px' }}>
        {/* I3: Inadimplência % */}
        <div className={styles.card} style={{ border: totalLate > 0 ? '1px solid rgba(255,80,80,0.4)' : '1px solid var(--border-color)', background: totalLate > 0 ? 'rgba(255,10,10,0.04)' : '' }}>
          <div className={styles.cardHeader}>
            <span>Inadimplência do Mês</span>
            <div className={styles.iconWrapper} style={{ background: totalLate > 0 ? 'var(--danger-bg)' : 'rgba(255,255,255,0.05)' }}>
              <AlertTriangle size={20} color={totalLate > 0 ? 'var(--danger-color)' : 'var(--text-muted)'} />
            </div>
          </div>
          <span className={styles.cardValue} style={{ color: totalLate > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
            {inadimplenciaPct}%
          </span>
          <div className={styles.cardLabel} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>{formatBRL(totalLate)} em aberto</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Rolling 30d: <strong style={{ color: Number(rolling30Pct) > 0 ? 'var(--warning-color)' : 'var(--success-color)' }}>{rolling30Pct}%</strong>
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Taxa de Vacância</span>
            <div className={styles.iconWrapper}><DoorOpen size={20} color="var(--text-secondary)" /></div>
          </div>
          <span className={styles.cardValue} style={{ color: Number(vacancyRate) > 20 ? 'var(--warning-color)' : 'white' }}>{vacancyRate}%</span>
          <div className={styles.cardLabel}>{totalProps! - (rentedProps || 0)} vagos de {totalProps || 0} imóveis</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Imóveis Locados</span>
            <div className={`${styles.iconWrapper} ${styles.iconTax}`}><Building2 size={20} /></div>
          </div>
          <span className={styles.cardValue}>{rentedProps || 0}</span>
          <div className={styles.cardLabel}>Gerando renda ativa agora</div>
        </div>
      </div>

      {/* ── LINHA 3: I3 — Alertas e Rankings */}
      <h2 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Clock size={14} style={{ display: 'inline', marginRight: '8px' }} />
        Alertas e Ranking
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>

        {/* I3: Vencimentos D-7 */}
        <div className={styles.card} style={{ gridColumn: '1' }}>
          <div className={styles.cardHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} color="var(--warning-color)" /> Vencimentos D-7
            </span>
            <span style={{ background: vencD7 && vencD7.length > 0 ? 'var(--warning-bg)' : 'rgba(255,255,255,0.05)', color: vencD7 && vencD7.length > 0 ? 'var(--warning-color)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
              {vencD7?.length || 0}
            </span>
          </div>
          {vencD7 && vencD7.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {vencD7.slice(0, 3).map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>{formatDate(v.due_date)}</span>
                  <span style={{ color: 'var(--warning-color)', fontWeight: 600 }}>{formatBRL(v.amount)}</span>
                </div>
              ))}
              {vencD7.length > 3 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>+{vencD7.length - 3} outros</span>}
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--success-color)', marginTop: '8px', display: 'block' }}>✓ Sem vencimentos próximos</span>
          )}
        </div>

        {/* I3: Contratos expirando 30d */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarX size={14} color="var(--danger-color)" /> Contratos expirando
            </span>
            <span style={{ background: expiringLeases && expiringLeases.length > 0 ? 'var(--danger-bg)' : 'rgba(255,255,255,0.05)', color: expiringLeases && expiringLeases.length > 0 ? 'var(--danger-color)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
              {expiringLeases?.length || 0}
            </span>
          </div>
          {expiringLeases && expiringLeases.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {expiringLeases.slice(0, 3).map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{l.property?.name}</span>
                  <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{formatDate(l.end_date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--success-color)', marginTop: '8px', display: 'block' }}>✓ Sem expirações em 30 dias</span>
          )}
        </div>

        {/* I3: Top 3 Yield */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trophy size={14} color="#FFD700" /> Top 3 Yield Anual
            </span>
          </div>
          {top3Yield.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {top3Yield.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#000', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-color)' }}>{p.yield!.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
              Adicione o valor de compra nos imóveis para ver o ranking de Yield.
            </span>
          )}
        </div>
      </div>
      {/* ── LINHA 4: ALERTAS DE CONTRATOS (Vencimento + Reajuste) */}
      {leaseAlertsData.length > 0 && (
        <>
          <h2 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <Bell size={14} style={{ display: 'inline', marginRight: '8px' }} color="var(--warning-color)" />
            Alertas de Contratos
          </h2>
          <div style={{ background: 'rgba(255,180,0,0.03)', border: '1px solid rgba(255,180,0,0.15)', borderRadius: '16px', padding: '4px 0', marginBottom: '32px' }}>
            {leaseAlertsData.map((alert, i) => {
              const isExpiring = alert.alert_type === 'contract_expiring'
              const isOverdue = alert.days_remaining <= 0
              const isUrgent = alert.days_remaining <= 7
              const color = isOverdue ? 'var(--danger-color)' : isUrgent ? 'var(--danger-color)' : 'var(--warning-color)'
              const icon = isExpiring ? '📋' : '📅'
              const label = isExpiring
                ? isOverdue ? 'Contrato Vencido!' : `Vence em ${alert.days_remaining} dias`
                : isOverdue ? 'Reajuste Atrasado!' : `Reajuste em ${alert.days_remaining} dias`
              return (
                <div key={`${alert.lease_id}-${alert.alert_type}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < leaseAlertsData.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{icon}</span>
                    <div>
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{alert.property_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block' }}>
                        {alert.tenant_name}{!isExpiring && alert.adjustment_index ? ` · Índice: ${alert.adjustment_index}` : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(alert.alert_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color, background: isOverdue ? 'var(--danger-bg)' : 'var(--warning-bg)', padding: '4px 10px', borderRadius: '8px', border: `1px solid ${isOverdue ? 'rgba(255,50,50,0.3)' : 'rgba(255,180,0,0.3)'}` }}>
                      {label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── ALERTA: Faturamento mensal com problema */}
      {lastBilling && (lastBilling.status === 'failed' || lastBilling.status === 'warning') && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          background: lastBilling.status === 'failed' ? 'rgba(255,50,50,0.06)' : 'rgba(255,180,0,0.06)',
          border: `1px solid ${lastBilling.status === 'failed' ? 'rgba(255,50,50,0.35)' : 'rgba(255,180,0,0.35)'}`,
          borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
        }}>
          <AlertTriangle size={18} color={lastBilling.status === 'failed' ? 'var(--danger-color)' : 'var(--warning-color)'} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <span style={{ fontWeight: 600, color: lastBilling.status === 'failed' ? 'var(--danger-color)' : 'var(--warning-color)', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
              {lastBilling.status === 'failed' ? 'Falha no Faturamento Mensal' : 'Atenção: Faturamento Mensal Incompleto'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {lastBilling.error_message ?? 'Verifique o job generate-monthly-rents.'}
              {' · '}
              <span style={{ color: 'var(--text-muted)' }}>
                Última execução: {new Date(lastBilling.run_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </span>
            </span>
          </div>
        </div>
      )}
    </>
  )
}

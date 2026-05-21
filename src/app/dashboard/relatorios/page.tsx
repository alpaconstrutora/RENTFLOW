import styles from '../../page.module.css'
import { createClientWithUser } from '../../../utils/supabase/server'
import ReportActions from './ReportActions'

interface SearchParams { ano?: string }

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedParams = await searchParams
  const { supabase, user } = await createClientWithUser()

  // C4: user_today via RPC
  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user?.id ?? '' })
  const today = (todayStr as string) ?? new Date().toLocaleString('sv', { timeZone: 'America/Sao_Paulo' }).split(' ')[0]
  const currentYear = parseInt(today.split('-')[0])
  
  const selectedYear = resolvedParams.ano ? parseInt(resolvedParams.ano) : currentYear

  // Gerar 12 meses do ano selecionado
  const months: string[] = []
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(selectedYear, i - 1, 1))
    months.push(d.toISOString().split('T')[0])
  }

  // Buscar todas as transações ativas pagas do ano selecionado
  const { data: transactions, error } = await supabase
    .from('transactions_view')
    .select('type, amount, net_amount, status, billing_month')
    .eq('status', 'paid')
    .gte('billing_month', months[0])
    .lte('billing_month', `${selectedYear}-12-31`)
    
  if (error) {
    console.error("Erro ao buscar transações:", error)
  }

  // Agrupar por mês
  const monthData: Record<string, { income: number; expense: number }> = {}
  for (const m of months) {
    monthData[m] = { income: 0, expense: 0 }
  }
  for (const tx of transactions ?? []) {
    const rawBm = tx.billing_month?.split('T')[0] ?? ''
    // Normalizar para o dia 01 do mês para suportar dados legados
    const bm = rawBm ? `${rawBm.substring(0, 7)}-01` : ''
    
    if (monthData[bm]) {
      const val = Number(tx.net_amount ?? tx.amount)
      if (tx.type === 'income') monthData[bm].income += val
      else monthData[bm].expense += val
    }
  }

  // Calcular totais e máximos para barras
  const entries = months.map(m => ({
    month: m,
    income: monthData[m].income,
    expense: monthData[m].expense,
    profit: monthData[m].income - monthData[m].expense
  }))

  const maxVal = Math.max(...entries.map(e => Math.max(e.income, e.expense)), 1)
  const totalIncome = entries.reduce((s, e) => s + e.income, 0)
  const totalExpense = entries.reduce((s, e) => s + e.expense, 0)
  const totalProfit = totalIncome - totalExpense

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  }

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Relatórios Financeiros</h1>
          <p className={styles.subtitle}>Comparativo mensal de 12 meses com DRE simplificado e exportação.</p>
        </div>
        <ReportActions selectedYear={selectedYear} currentYear={currentYear} />
      </header>

      {/* Totalizadores 12 meses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(0,255,100,0.05)', border: '1px solid rgba(0,255,100,0.15)', borderRadius: '14px', padding: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Receitas (12m)</p>
          <p style={{ color: 'var(--success-color)', fontSize: '24px', fontWeight: 700, margin: 0 }}>{formatBRL(totalIncome)}</p>
        </div>
        <div style={{ background: 'rgba(255,50,50,0.05)', border: '1px solid rgba(255,50,50,0.15)', borderRadius: '14px', padding: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Despesas (12m)</p>
          <p style={{ color: 'var(--danger-color)', fontSize: '24px', fontWeight: 700, margin: 0 }}>{formatBRL(totalExpense)}</p>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '14px', padding: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Lucro Real (12m)</p>
          <p style={{ color: totalProfit >= 0 ? 'var(--accent-color)' : 'var(--danger-color)', fontSize: '24px', fontWeight: 700, margin: 0 }}>{formatBRL(totalProfit)}</p>
        </div>
      </div>

      {/* Tabela Comparativa 12 Meses */}
      <div id="relatorio-12m" className="glass-panel" style={{ padding: '20px', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <h3 style={{ color: 'white', marginBottom: '16px', fontSize: '16px' }}>Comparativo Mensal — Últimos 12 Meses</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Mês</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Receitas</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Despesas</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Lucro</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, width: '30%' }}>Visualização</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.month} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500, textTransform: 'capitalize' }}>
                  {formatMonth(e.month)}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--success-color)' }}>
                  {formatBRL(e.income)}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--danger-color)' }}>
                  {formatBRL(e.expense)}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: e.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                  {formatBRL(e.profit)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', gap: '2px', alignItems: 'flex-end', height: '24px' }}>
                      <div style={{ width: `${Math.max((e.income / maxVal) * 100, 2)}%`, height: '10px', background: 'var(--success-color)', borderRadius: '3px', opacity: 0.7 }} title={`Receita: ${formatBRL(e.income)}`} />
                      <div style={{ width: `${Math.max((e.expense / maxVal) * 100, 2)}%`, height: '10px', background: 'var(--danger-color)', borderRadius: '3px', opacity: 0.7 }} title={`Despesa: ${formatBRL(e.expense)}`} />
                    </div>
                    <a href={`/dashboard/relatorios/${e.month.substring(0, 7)}`} style={{ fontSize: '12px', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, padding: '4px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px' }}>
                      Detalhes
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
              <td style={{ padding: '14px 16px', color: 'white' }}>Total (12m)</td>
              <td style={{ padding: '14px 16px', color: 'var(--success-color)' }}>{formatBRL(totalIncome)}</td>
              <td style={{ padding: '14px 16px', color: 'var(--danger-color)' }}>{formatBRL(totalExpense)}</td>
              <td style={{ padding: '14px 16px', color: totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{formatBRL(totalProfit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

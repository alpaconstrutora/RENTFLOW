import { createClient } from '../../../../utils/supabase/server'
import styles from '../../../page.module.css'
import ReportActions from '../ReportActions'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function RelatorioMensalPage({ params }: { params: Promise<{ month: string }> }) {
  const resolvedParams = await params
  const monthParam = resolvedParams.month // Format: yyyy-mm

  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    redirect('/dashboard/relatorios')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const startOfMonth = `${monthParam}-01`
  // We determine the end of the month by getting the start of next month
  const [y, m] = monthParam.split('-').map(Number)
  const nextMonthDate = new Date(y, m, 1)
  const endOfMonth = nextMonthDate.toISOString().split('T')[0]

  // Invariante #13 — leitura via transactions_view, nunca tabela direta
  const { data: transactions } = await supabase
    .from('transactions_view')
    .select('type, amount, net_amount, discount_amount, addition_amount, status, billing_month, property_id, property_name')
    .eq('status', 'paid')
    .gte('billing_month', startOfMonth)
    .lt('billing_month', endOfMonth)
    .order('billing_month', { ascending: true })

  // Tipos dos imóveis — query separada (não disponível na view)
  const { data: propertiesRaw } = await supabase
    .from('properties').select('id, type')
  const propTypeMap: Record<string, string> = {}
  for (const p of propertiesRaw ?? []) propTypeMap[p.id] = p.type

  let totalIncome = 0
  let totalExpense = 0

  const propertyStats: Record<string, { id: string, name: string, type: string, income: number, expense: number }> = {}

  for (const t of transactions || []) {
    const isIncome = t.type === 'income'
    const netAmount = Number(t.net_amount ?? t.amount)

    if (isIncome) totalIncome += netAmount
    else totalExpense += netAmount

    if (t.property_id) {
      const propId = t.property_id
      if (!propertyStats[propId]) {
        propertyStats[propId] = {
          id: propId,
          name: t.property_name ?? 'Desconhecido',
          type: propTypeMap[propId] ?? 'residential',
          income: 0, expense: 0
        }
      }
      if (isIncome) propertyStats[propId].income += netAmount
      else propertyStats[propId].expense += netAmount
    }
  }

  const netProfit = totalIncome - totalExpense

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const monthName = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Transform to array for mapping
  const propertyList = Object.values(propertyStats).sort((a, b) => b.income - a.income)

  return (
    <div className="report-container">
      {/* Esconder este header apenas na hora da impressão via CSS que criaremos no global/module */}
      <header className={`${styles.header} print-hidden`}>
        <div>
          <div style={{ marginBottom: '8px' }}>
             <Link href="/dashboard/relatorios" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={14} /> Voltar para Relatórios Anuais
             </Link>
          </div>
          <h1 className={styles.title}>Extrato Consolidado</h1>
          <p className={styles.subtitle}>Referência: <span style={{ textTransform: 'capitalize' }}>{monthName}</span></p>
        </div>
        <ReportActions selectedYear={y} currentYear={y} />
      </header>

      {/* A área a ser impressa (folha A4) */}
      <div className="print-area" style={{ background: 'white', color: 'black', padding: '40px', borderRadius: '8px', minHeight: '800px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
            <div>
               <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#111' }}>RentFlow Report</h2>
               <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>Fechamento Patrimonial — <span style={{ textTransform: 'capitalize' }}>{monthName}</span></p>
            </div>
            <div style={{ textAlign: 'right' }}>
               <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Data de Emissão</p>
               <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111' }}>{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
         </div>

         {/* Sumário */}
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
            <div style={{ padding: '16px', background: '#f8fafc', borderLeft: '4px solid #10b981', borderRadius: '4px' }}>
               <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Receita Total (Paga)</p>
               <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{formatBRL(totalIncome)}</p>
            </div>
            <div style={{ padding: '16px', background: '#f8fafc', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
               <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Despesas / Impostos</p>
               <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{formatBRL(totalExpense)}</p>
            </div>
            <div style={{ padding: '16px', background: '#f8fafc', borderLeft: `4px solid ${netProfit >= 0 ? '#6366f1' : '#ef4444'}`, borderRadius: '4px' }}>
               <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Resultado Operacional</p>
               <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{formatBRL(netProfit)}</p>
            </div>
         </div>

         {/* Tabela de Imóveis */}
         <h3 style={{ fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px', color: '#334155' }}>Performance por Unidade (Liquidados)</h3>
         <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '14px' }}>
            <thead>
               <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '12px', fontWeight: 600 }}>Unidade</th>
                  <th style={{ padding: '12px', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '12px', fontWeight: 600, textAlign: 'right' }}>Entradas</th>
                  <th style={{ padding: '12px', fontWeight: 600, textAlign: 'right' }}>Saídas</th>
                  <th style={{ padding: '12px', fontWeight: 600, textAlign: 'right' }}>Líquido Unidade</th>
               </tr>
            </thead>
            <tbody>
               {propertyList.length === 0 && (
                 <tr>
                   <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma transação liquidada neste mês.</td>
                 </tr>
               )}
               {propertyList.map((p) => {
                 const unitNet = p.income - p.expense
                 return (
                   <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', color: '#0f172a', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '12px', color: '#64748b', textTransform: 'capitalize' }}>{p.type === 'residential' ? 'Residencial' : 'Comercial'}</td>
                      <td style={{ padding: '12px', color: '#10b981', textAlign: 'right' }}>{formatBRL(p.income)}</td>
                      <td style={{ padding: '12px', color: '#ef4444', textAlign: 'right' }}>{formatBRL(p.expense)}</td>
                      <td style={{ padding: '12px', color: unitNet >= 0 ? '#0f172a' : '#ef4444', textAlign: 'right', fontWeight: 600 }}>{formatBRL(unitNet)}</td>
                   </tr>
                 )
               })}
            </tbody>
         </table>

         <div style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #eee', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
            Este relatório consolida apenas transações patrimoniais marcadas com status de 'Pago/Liquidado' na referência de {monthName}.
            Não possui valor legal. Recomendado apenas para gestão e conferência contábil interna (RentFlow).
         </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .print-hidden { display: none !important; }
          #sidebar { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .print-area { padding: 0 !important; box-shadow: none !important; color: black !important; background: white !important; }
        }
      `}} />
    </div>
  )
}

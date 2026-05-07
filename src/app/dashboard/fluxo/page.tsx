import { ArrowDownRight, ArrowUpRight, CalendarClock, ShieldAlert, Filter } from 'lucide-react'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import TransactionAction from './TransactionAction'
import NovaTransacaoBtn from './NovaTransacaoBtn'
import { Suspense } from 'react'
import FluxoFilters from './FluxoFilters'

interface SearchParams { mes?: string; ano?: string; imovel?: string; tipo?: string; status?: string }

export default async function FluxoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedParams = await searchParams
  const supabase = await createClient()

  // I6: Construir query filtrada via URL params (server-side)
  let query = supabase
    .from('transactions_view')
    .select('id, type, amount, net_amount, discount_amount, addition_amount, adjustment_notes, due_date, paid_date, billing_month, status, xmin, notes, is_auto_generated, property_id, property_name, tenant_name, recurrence_group_id, category_id, created_at')

  // Invariante #13 — leitura via view, nunca tabela direta
  if (resolvedParams.mes) {
    query = query.eq('billing_month', resolvedParams.mes + '-01')
  } else if (resolvedParams.ano) {
    query = query
      .gte('billing_month', `${resolvedParams.ano}-01-01`)
      .lte('billing_month', `${resolvedParams.ano}-12-01`)
  }
  if (resolvedParams.imovel) {
    query = query.eq('property_id', resolvedParams.imovel)
  }
  if (resolvedParams.tipo) {
    query = query.eq('type', resolvedParams.tipo)
  }
  if (resolvedParams.status) {
    // Se filtro de status inclui 'cancelled', precisamos considerar que a view exclui cancelled
    // Para simplicidade do MVP, status cancelled nunca aparece (filtrado pela view)
    query = query.eq('status', resolvedParams.status)
  }

  const { data: transactions, error } = await query.order('due_date', { ascending: false })

  // Buscar imóveis e contratos para o modal de Nova Transação (I5)
  const { data: properties } = await supabase.from('properties').select('id, name').order('name')
  const { data: leases } = await supabase.from('leases').select('id, property_id, rent_value').eq('active', true)
  const { data: categories } = await supabase.from('categories').select('id, name, type').order('name')

  // Extrair meses únicos para o filtro
  const uniqueMonths = [...new Set(
    transactions?.map(t => t.billing_month?.split('T')[0] ?? '').filter(Boolean) ?? []
  )].sort().reverse()

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '---'
    const [y, m, d] = dateStr.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  }

  // Totalizadores da visão atual
  const totalReceitas = transactions?.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0) || 0
  const totalDespesas = transactions?.filter(t => t.type === 'expense' && t.status === 'paid').reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0) || 0
  const totalPendente = transactions?.filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0) || 0

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Fluxo de Caixa</h1>
          <p className={styles.subtitle}>Extrato B2B — leitura exclusiva via <code style={{ fontSize: '12px', opacity: 0.7 }}>transactions_view</code> (Inv. #13)</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <NovaTransacaoBtn properties={properties ?? []} leases={leases ?? []} />
        </div>
      </header>

      {/* Totalizadores rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(0,255,100,0.15)', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: 600, margin: '0 0 4px' }}>↑ Recebido (filtro atual)</p>
          <p style={{ fontSize: '22px', color: 'white', fontWeight: 700, margin: 0 }}>{formatBRL(totalReceitas)}</p>
        </div>
        <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(255,50,50,0.15)', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--danger-color)', fontWeight: 600, margin: '0 0 4px' }}>↓ Pago em Despesas</p>
          <p style={{ fontSize: '22px', color: 'white', fontWeight: 700, margin: 0 }}>{formatBRL(totalDespesas)}</p>
        </div>
        <div style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.2)', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--warning-color)', fontWeight: 600, margin: '0 0 4px' }}>⏳ A Vencer / Pendente</p>
          <p style={{ fontSize: '22px', color: 'white', fontWeight: 700, margin: 0 }}>{formatBRL(totalPendente)}</p>
        </div>
      </div>

      {/* I6: Barra de filtros + I7: Export CSV */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', marginRight: '4px' }}>
          <Filter size={14} />
          Filtros:
        </div>
        <Suspense fallback={null}>
          <FluxoFilters
            months={uniqueMonths}
            properties={properties ?? []}
            transactions={transactions ?? []}
            currentYear={resolvedParams.ano ?? ''}
          />
        </Suspense>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-color)', padding: '20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert color="var(--danger-color)" />
          <div>
            <h3 style={{ color: 'var(--danger-color)', margin: 0 }}>Erro de Acesso</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{error.message}</p>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '16px', fontWeight: 500 }}>Operação / Origem</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Cliente</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Vencimento</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Liquidação</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Valor</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {transactions?.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {t.type === 'income' ? (
                      <div className={styles.iconWrapper} style={{ background: 'var(--success-bg)' }}>
                        <ArrowUpRight size={18} color="var(--success-color)" />
                      </div>
                    ) : (
                      <div className={styles.iconWrapper} style={{ background: 'var(--danger-bg)' }}>
                        <ArrowDownRight size={18} color="var(--danger-color)" />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>
                        {t.notes || (t.type === 'income' ? 'Recebimento de Aluguel' : 'Despesa Operacional')}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {t.property_name || 'N/A'}
                        {t.is_auto_generated && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--accent-color)', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: '4px' }}>Auto</span>}
                      </span>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '16px' }}>
                  {t.tenant_name
                    ? <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.tenant_name}</span>
                    : <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                  }
                </td>

                <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CalendarClock size={14} />
                    {formatDate(t.due_date)}
                  </div>
                </td>

                <td style={{ padding: '16px' }}>
                  {t.paid_date
                    ? <span style={{ color: 'var(--success-color)', fontSize: '13px' }}>{formatDate(t.paid_date)}</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
                  }
                </td>

                <td style={{ padding: '16px', fontWeight: 500 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(t.discount_amount > 0 || t.addition_amount > 0) ? (
                      <>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }} title="Valor Original do Contrato">
                          {formatBRL(t.amount)}
                        </span>
                        <span 
                          style={{ color: t.type === 'income' ? 'var(--success-color)' : 'var(--danger-color)' }}
                          title={t.adjustment_notes ? `Motivo do Ajuste: ${t.adjustment_notes}` : 'Valor Ajustado'}
                        >
                          {t.type === 'income' ? '+' : '-'} {formatBRL(t.net_amount)}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: t.type === 'income' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                        {t.type === 'income' ? '+' : '-'} {formatBRL(t.amount)}
                      </span>
                    )}
                  </div>
                </td>

                <td style={{ padding: '16px' }}>
                  {t.status === 'pending' && <span style={{ color: 'var(--warning-color)', padding: '4px 10px', borderRadius: '4px', background: 'var(--warning-bg)', fontSize: '12px', fontWeight: 600 }}>Pendente</span>}
                  {t.status === 'late' && <span style={{ color: 'var(--danger-color)', padding: '4px 10px', borderRadius: '4px', background: 'var(--danger-bg)', fontSize: '12px', fontWeight: 600 }}>Em Atraso</span>}
                  {t.status === 'paid' && <span style={{ color: 'var(--success-color)', padding: '4px 10px', borderRadius: '4px', background: 'var(--success-bg)', fontSize: '12px', fontWeight: 600 }}>Liquidada</span>}
                  {t.status === 'cancelled' && <span style={{ color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', fontSize: '12px', fontWeight: 600 }}>Anulada</span>}
                </td>

                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <TransactionAction
                    transactionId={t.id}
                    currentStatus={t.status}
                    xmin={t.xmin}
                    type={t.type}
                    isAutoGenerated={t.is_auto_generated}
                    recurrenceGroupId={t.recurrence_group_id}
                    notes={t.notes}
                    dueDate={t.due_date}
                    categories={categories ?? []}
                  />
                </td>
              </tr>
            ))}

            {(!transactions || transactions.length === 0) && !error && (
              <tr>
                <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma transação encontrada com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

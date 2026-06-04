'use client'

import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarClock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import styles from '../../page.module.css'
import TransactionAction from './TransactionAction'

interface TransactionRow {
  id: string
  type: string
  amount: number
  net_amount: number
  discount_amount: number
  addition_amount: number
  adjustment_notes: string | null
  due_date: string | null
  paid_date: string | null
  billing_month: string | null
  status: string
  xmin: string
  notes: string | null
  is_auto_generated: boolean
  property_id: string
  property_name: string | null
  tenant_name: string | null
  recurrence_group_id: string | null
  category_id: string | null
  created_at: string
}

interface FluxoTableProps {
  transactions: TransactionRow[]
  categories: { id: string; name: string; type: string }[]
}

type SortField = 'notes' | 'tenant' | 'due' | 'paid' | 'value' | 'status'
type SortOrder = 'asc' | 'desc'

export default function FluxoTable({ transactions: initialTransactions, categories }: FluxoTableProps) {
  const [sortField, setSortField] = useState<SortField>('due')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '---'
    const [y, m, d] = dateStr.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  }

  // Ordenação client-side
  const sortedTransactions = [...(initialTransactions || [])].sort((a, b) => {
    let valA: any = null
    let valB: any = null

    switch (sortField) {
      case 'notes':
        valA = a.notes?.toLowerCase() || (a.type === 'income' ? 'recebimento de aluguel' : 'despesa operacional')
        valB = b.notes?.toLowerCase() || (b.type === 'income' ? 'recebimento de aluguel' : 'despesa operacional')
        break
      case 'tenant':
        valA = a.tenant_name?.toLowerCase() || ''
        valB = b.tenant_name?.toLowerCase() || ''
        break
      case 'due':
        valA = a.due_date || ''
        valB = b.due_date || ''
        break
      case 'paid':
        valA = a.paid_date || ''
        valB = b.paid_date || ''
        break
      case 'value':
        valA = a.net_amount ?? a.amount ?? 0
        valB = b.net_amount ?? b.amount ?? 0
        break
      case 'status':
        valA = a.status?.toLowerCase() || ''
        valB = b.status?.toLowerCase() || ''
        break
      default:
        return 0
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const renderHeader = (label: string, field: SortField) => {
    const isSorted = sortField === field
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          padding: '16px',
          fontWeight: 500,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color 0.2s',
        }}
        className="sortable-header"
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>{label}</span>
          {isSorted ? (
            sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
          ) : (
            <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
          )}
        </div>
      </th>
    )
  }

  return (
    <>
      <style>{`
        .sortable-header:hover {
          color: var(--text-primary) !important;
        }
      `}</style>
      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              {renderHeader('Operação / Origem', 'notes')}
              {renderHeader('Cliente', 'tenant')}
              {renderHeader('Vencimento', 'due')}
              {renderHeader('Liquidação', 'paid')}
              {renderHeader('Valor', 'value')}
              {renderHeader('Status', 'status')}
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((t) => (
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
                    categories={categories}
                  />
                </td>
              </tr>
            ))}

            {(!sortedTransactions || sortedTransactions.length === 0) && (
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

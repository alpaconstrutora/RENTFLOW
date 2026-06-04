'use client'

import { useState } from 'react'
import { FileText, User, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import styles from '../../page.module.css'
import LeaseEditBtn from './LeaseEditBtn'
import LeaseDuplicateBtn from './LeaseDuplicateBtn'
import DistratoBtn from './DistratoBtn'
import LeaseDeleteBtn from './LeaseDeleteBtn'

interface LeaseRow {
  id: string
  code: number
  rent_value: number
  start_date: string
  end_date: string | null
  billing_start_date: string | null
  due_day: number
  active: boolean
  adjustment_index: string | null
  adjustment_period_months: number | null
  next_adjustment_date: string | null
  iptu_paid_by: string | null
  condo_paid_by: string | null
  landlord_profile_id: string | null
  guarantee_type: string | null
  property_id: string
  tenant_id: string
  property: { name: string } | null
  tenant: { name: string } | null
  transactions?: { id: string }[] | null
  contract_instances?: { id: string; status: string }[] | null
}

interface LeaseTableProps {
  leases: LeaseRow[] | null
  landlordProfiles: { id: string, name: string, person_type: string, document: string | null, is_default: boolean }[]
  properties: { id: string, name: string, status: string }[]
  tenants: { id: string, name: string }[]
}

type SortField = 'code' | 'property' | 'rent_value' | 'tenant' | 'start_date' | 'next_adjustment_date'
type SortOrder = 'asc' | 'desc'

function daysBetween(dateStr: string) {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function AlertBadge({ days, type }: { days: number, type: 'expiring' | 'adjustment' }) {
  const label = type === 'expiring'
    ? days < 0 ? '⚠ Contrato Vencido!' : days === 0 ? '⚠ Vence Hoje!' : `⚠ Vence em ${days}d`
    : days < 0 ? '🔔 Reajuste Atrasado!' : days === 0 ? '🔔 Reajustar Hoje!' : `🔔 Reajuste em ${days}d`

  const color = days <= 7 ? 'var(--danger-color)' : days <= 30 ? 'var(--warning-color)' : 'var(--success-color)'
  const bg = days <= 7 ? 'var(--danger-bg)' : days <= 30 ? 'var(--warning-bg)' : 'rgba(0,255,100,0.05)'
  const border = days <= 7 ? 'rgba(255,50,50,0.3)' : days <= 30 ? 'rgba(255,180,0,0.3)' : 'rgba(0,255,100,0.15)'

  return (
    <span style={{ fontSize: '11px', fontWeight: 600, color, background: bg, border: `1px solid ${border}`, padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export default function LeaseTable({ leases: initialLeases, landlordProfiles, properties, tenants }: LeaseTableProps) {
  const [sortField, setSortField] = useState<SortField>('code')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  // Lógica de ordenação em memória
  const sortedLeases = [...(initialLeases || [])].sort((a, b) => {
    let valA: any = null
    let valB: any = null

    switch (sortField) {
      case 'code':
        valA = a.code || 0
        valB = b.code || 0
        break
      case 'property':
        valA = a.property?.name?.toLowerCase() || ''
        valB = b.property?.name?.toLowerCase() || ''
        break
      case 'rent_value':
        valA = a.rent_value || 0
        valB = b.rent_value || 0
        break
      case 'tenant':
        valA = a.tenant?.name?.toLowerCase() || ''
        valB = b.tenant?.name?.toLowerCase() || ''
        break
      case 'start_date':
        valA = a.start_date || ''
        valB = b.start_date || ''
        break
      case 'next_adjustment_date':
        valA = a.next_adjustment_date || ''
        valB = b.next_adjustment_date || ''
        break
      default:
        return 0
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const renderHeader = (label: string, field: SortField, alignRight = false) => {
    const isSorted = sortField === field
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          padding: '16px',
          fontWeight: 500,
          cursor: 'pointer',
          userSelect: 'none',
          textAlign: alignRight ? 'right' : 'left',
          transition: 'color 0.2s',
        }}
        className="sortable-header"
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          justifyContent: alignRight ? 'flex-end' : 'flex-start',
          width: '100%'
        }}>
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
              {renderHeader('Código', 'code')}
              {renderHeader('Imóvel', 'property')}
              {renderHeader('Rentabilidade', 'rent_value')}
              {renderHeader('Inquilino', 'tenant')}
              {renderHeader('Vigência', 'start_date')}
              {renderHeader('Próx. Reajuste', 'next_adjustment_date')}
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeases.map((lease) => {
              const endDays = lease.end_date ? daysBetween(lease.end_date) : null
              const adjDays = lease.next_adjustment_date ? daysBetween(lease.next_adjustment_date) : null
              const showEndAlert = endDays !== null && endDays <= 60
              const showAdjAlert = adjDays !== null && adjDays <= 30

              return (
                <tr key={lease.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {String(lease.code || '').padStart(3, '0')}
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className={styles.iconWrapper} style={{ background: 'rgba(255, 204, 0, 0.05)', border: '1px solid rgba(255, 204, 0, 0.15)' }}>
                        <FileText size={18} color="#FFCC00" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{lease.property?.name}</span>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '16px', fontWeight: 500 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--success-color)' }}>{formatBRL(lease.rent_value)}</span>
                      {lease.adjustment_index && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Índice: {lease.adjustment_index}</span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ 
                        background: 'rgba(0, 150, 255, 0.05)', 
                        border: '1px solid rgba(0, 150, 255, 0.15)', 
                        borderRadius: '6px',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <User size={14} color="#0096FF" />
                      </div>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{lease.tenant?.name || '—'}</span>
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatDate(lease.start_date)} — {formatDate(lease.end_date) || 'Indeterminado'}
                      </span>
                      {lease.active ? (
                        showEndAlert && endDays !== null ? (
                          <AlertBadge days={endDays} type="expiring" />
                        ) : (
                          <span style={{ color: 'var(--success-color)', fontSize: '12px', fontWeight: 600 }}>● Vigente</span>
                        )
                      ) : (
                        <span style={{ color: 'var(--danger-color)', fontSize: '12px', fontWeight: 600 }}>● Finalizado</span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    {lease.next_adjustment_date && adjDays !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {formatDate(lease.next_adjustment_date)}
                        </span>
                        {showAdjAlert ? (
                          <AlertBadge days={adjDays} type="adjustment" />
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {adjDays}d restantes
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
                      <a
                        href={`/dashboard/contratos/${lease.id}`}
                        title="Visualizar PDF"
                        style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}
                      >
                        <FileText size={16} />
                      </a>
                      <LeaseEditBtn
                        lease={{
                          ...lease,
                          hasTransactions: lease.transactions ? lease.transactions.length > 0 : false,
                          isIssued: lease.contract_instances ? lease.contract_instances.some(ci => ['ready', 'signed', 'archived'].includes(ci.status)) : false
                        }}
                        landlordProfiles={landlordProfiles}
                        properties={properties}
                        tenants={tenants}
                      />
                      <LeaseDuplicateBtn
                        lease={lease}
                        properties={properties}
                        tenants={tenants}
                        landlordProfiles={landlordProfiles}
                      />
                      {lease.active ? (
                        <DistratoBtn lease={lease} />
                      ) : (
                        <LeaseDeleteBtn id={lease.id} />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {(!sortedLeases || sortedLeases.length === 0) && (
              <tr>
                <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Sem contratos de locação registrados. Efetue um novo contrato associando um Imóvel a um Cliente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

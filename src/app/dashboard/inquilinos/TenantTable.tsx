'use client'

import { useState } from 'react'
import { Users, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import TenantEditBtn from './TenantEditBtn'
import TenantDeleteBtn from './TenantDeleteBtn'

interface TenantRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  type: string | null
  birth_date: string | null
  marital_status: string | null
  profession: string | null
  rg: string | null
  nationality: string | null
  monthly_income: number | null
  zip_code: string | null
  street: string | null
  street_number: string | null
  district: string | null
  city: string | null
  state: string | null
  address_complement: string | null
  photo_url: string | null
  guarantor_name: string | null
  guarantor_document: string | null
  notes: string | null
}

interface TenantTableProps {
  tenants: TenantRow[]
  userId: string
}

type SortField = 'name' | 'document' | 'email'
type SortOrder = 'asc' | 'desc'

export default function TenantTable({ tenants: initialTenants, userId }: TenantTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Ordenação client-side
  const sortedTenants = [...initialTenants].sort((a, b) => {
    let valA: any = null
    let valB: any = null

    switch (sortField) {
      case 'name':
        valA = a.name?.toLowerCase() || ''
        valB = b.name?.toLowerCase() || ''
        break
      case 'document':
        valA = a.document || ''
        valB = b.document || ''
        break
      case 'email':
        valA = a.email?.toLowerCase() || ''
        valB = b.email?.toLowerCase() || ''
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
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              {renderHeader('Nome', 'name')}
              {renderHeader('Documento', 'document')}
              {renderHeader('Contato', 'email')}
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedTenants.map(tenant => {
              const isPJ = tenant.type === 'company'
              return (
                <tr key={tenant.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'rgba(74,111,255,0.1)', border: '1px solid rgba(74,111,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {tenant.photo_url ? (
                          <img src={tenant.photo_url} alt={tenant.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Users size={18} color="var(--accent-color)" />
                        )}
                      </div>
                      <div>
                        <span style={{ fontWeight: 500, display: 'block' }}>{tenant.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {isPJ ? '🏢 PJ' : '👤 PF'}
                          {tenant.profession ? ` · ${tenant.profession}` : ''}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{tenant.document || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}</span>
                      {tenant.guarantor_name && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fiador: {tenant.guarantor_name}</span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {tenant.email && <span style={{ color: 'var(--text-secondary)' }}>{tenant.email}</span>}
                      {tenant.phone && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{tenant.phone}</span>}
                      {!tenant.email && !tenant.phone && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                    </div>
                  </td>

                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
                      <TenantEditBtn userId={userId} tenant={tenant} />
                      <TenantDeleteBtn id={tenant.id} />
                    </div>
                  </td>
                </tr>
              )
            })}

            {sortedTenants.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum inquilino cadastrado. Clique em &quot;Cadastrar Inquilino&quot; para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

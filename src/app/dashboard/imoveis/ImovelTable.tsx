'use client'

import { useState } from 'react'
import { TrendingUp, ArrowUp, ArrowDown, ArrowUpDown, Eye } from 'lucide-react'
import ImovelEditBtn from './ImovelEditBtn'
import ImovelDeleteBtn from './ImovelDeleteBtn'

const TYPE_LABELS: Record<string, string> = {
  residential:     'Residencial',
  commercial:      'Comercial',
  apartment:       'Apartamento',
  house:           'Casa',
  studio:          'Kitnet / Studio',
  commercial_room: 'Sala Comercial',
  store:           'Loja',
  warehouse:       'Galpão',
  land:            'Terreno',
}

interface PropertyRow {
  id: string
  name: string
  type: string
  status: string
  expected_rent: number | null
  purchase_value: number | null
  photo_url: string | null
  zip_code: string | null
  street: string | null
  street_number: string | null
  district: string | null
  city: string | null
  state: string | null
  address: string | null
  notes: string | null
  leases: { rent_value: number; active: boolean }[]
}

interface ImovelTableProps {
  properties: PropertyRow[]
  profitMap: Record<string, number>
  monthsMap: Record<string, number>
  userId: string
}

type SortField = 'property' | 'type' | 'status' | 'rent' | 'roiAcum' | 'roiAnualizado'
type SortOrder = 'asc' | 'desc'

export default function ImovelTable({ properties: initialProperties, profitMap, monthsMap, userId }: ImovelTableProps) {
  const [sortField, setSortField] = useState<SortField>('property')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const formatBRL = (val: number | null | undefined) =>
    val == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatPct = (val: number | null) =>
    val == null ? '—' : `${val.toFixed(2)}%`

  function addressLine(p: PropertyRow): string | null {
    if (p.street) {
      const parts = [p.street, p.street_number, p.district, p.city && p.state ? `${p.city} - ${p.state}` : p.city].filter(Boolean)
      return parts.join(', ')
    }
    return p.address
  }

  // Lógica de ordenação client-side
  const sortedProperties = [...initialProperties].sort((a, b) => {
    let valA: any = null
    let valB: any = null

    const getRentVal = (p: PropertyRow) => {
      const activeLeases = p.leases?.filter(l => l.active) || []
      return activeLeases[0]?.rent_value ?? p.expected_rent ?? 0
    }

    const getRoiAcum = (p: PropertyRow) => {
      const purchaseValue = p.purchase_value != null && p.purchase_value > 0 ? p.purchase_value : null
      const totalProfit = profitMap[p.id] || 0
      return purchaseValue && totalProfit !== 0 ? (totalProfit / purchaseValue) * 100 : 0
    }

    const getRoiAnualizado = (p: PropertyRow) => {
      const purchaseValue = p.purchase_value != null && p.purchase_value > 0 ? p.purchase_value : null
      const totalProfit = profitMap[p.id] || 0
      const mesesComDados = monthsMap[p.id] ?? 0
      return purchaseValue && mesesComDados >= 3 ? (totalProfit / mesesComDados * 12) / purchaseValue * 100 : 0
    }

    switch (sortField) {
      case 'property':
        valA = a.name?.toLowerCase() || ''
        valB = b.name?.toLowerCase() || ''
        break
      case 'type':
        valA = TYPE_LABELS[a.type]?.toLowerCase() || a.type?.toLowerCase() || ''
        valB = TYPE_LABELS[b.type]?.toLowerCase() || b.type?.toLowerCase() || ''
        break
      case 'status':
        valA = a.status?.toLowerCase() || ''
        valB = b.status?.toLowerCase() || ''
        break
      case 'rent':
        valA = getRentVal(a)
        valB = getRentVal(b)
        break
      case 'roiAcum':
        valA = getRoiAcum(a)
        valB = getRoiAcum(b)
        break
      case 'roiAnualizado':
        valA = getRoiAnualizado(a)
        valB = getRoiAnualizado(b)
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
              {renderHeader('Imóvel', 'property')}
              {renderHeader('Tipo', 'type')}
              {renderHeader('Status', 'status')}
              {renderHeader('Aluguel / Yield Anual', 'rent')}
              {renderHeader('ROI Acumulado', 'roiAcum')}
              {renderHeader('ROI Anualizado', 'roiAnualizado')}
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedProperties.map(prop => {
              const activeLeases  = prop.leases?.filter(l => l.active) || []
              const currentRent   = activeLeases[0]?.rent_value ?? null
              const purchaseValue = prop.purchase_value != null && prop.purchase_value > 0 ? prop.purchase_value : null
              const yield_        = purchaseValue && currentRent ? (currentRent * 12) / purchaseValue * 100 : null
              const totalProfit   = profitMap[prop.id] || 0
              const roiAcum       = purchaseValue && totalProfit !== 0 ? (totalProfit / purchaseValue) * 100 : null
              const mesesComDados = monthsMap[prop.id] ?? 0
              const roiAnualizado = purchaseValue && mesesComDados >= 3 ? (totalProfit / mesesComDados * 12) / purchaseValue * 100 : null
              const addr          = addressLine(prop)

              return (
                <tr key={prop.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {/* Imóvel */}
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {prop.photo_url ? (
                          <img src={prop.photo_url} alt={prop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '22px' }}>🏠</span>
                        )}
                      </div>
                      <div>
                        <span style={{ fontWeight: 500, display: 'block' }}>{prop.name}</span>
                        {addr && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{addr}</span>}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {TYPE_LABELS[prop.type] ?? prop.type}
                  </td>

                  <td style={{ padding: '16px' }}>
                    {prop.status === 'rented' ? (
                      <span style={{ color: 'var(--success-color)', background: 'var(--success-bg)', padding: '5px 12px', borderRadius: '24px', fontSize: '13px', fontWeight: 600 }}>Locado</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--warning-color)', background: 'var(--warning-bg)', padding: '5px 12px', borderRadius: '24px', fontSize: '13px', fontWeight: 600 }}>Vago</span>
                        <a href="/dashboard/contratos" style={{ fontSize: '11px', color: 'var(--accent-color)', textDecoration: 'none' }}>Criar contrato →</a>
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--success-color)' }}>
                        {formatBRL(currentRent ?? prop.expected_rent)}/mês
                      </span>
                      <span style={{ fontSize: '12px', color: yield_ ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                        {yield_ ? (
                          <><TrendingUp size={11} style={{ display: 'inline', marginRight: '3px' }} />{formatPct(yield_)} yield/ano</>
                        ) : (
                          <span style={{ fontSize: '11px' }}>
                            {purchaseValue === null ? '— Adicionar valor de compra →' : '— Sem contrato ativo'}
                          </span>
                        )}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    {roiAcum !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: roiAcum >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{formatPct(roiAcum)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatBRL(totalProfit)} lucro total</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{purchaseValue === null ? '—' : 'Sem dados ainda'}</span>
                    )}
                  </td>

                  <td style={{ padding: '16px' }}>
                    {roiAnualizado !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: roiAnualizado >= 0 ? 'var(--accent-color)' : 'var(--danger-color)' }}>{formatPct(roiAnualizado)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{mesesComDados} meses de dados</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {mesesComDados < 3 && mesesComDados > 0 ? `${mesesComDados} meses — mín. 3` : purchaseValue === null ? '—' : 'Sem dados'}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
                      <a
                        href={`/dashboard/imoveis/${prop.id}`}
                        title="Detalhes"
                        style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '4px' }}
                      >
                        <Eye size={16} />
                      </a>
                      <ImovelEditBtn userId={userId} property={prop} />
                      <ImovelDeleteBtn id={prop.id} />
                    </div>
                  </td>
                </tr>
              )
            })}

            {(!sortedProperties || sortedProperties.length === 0) && (
              <tr>
                <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum imóvel cadastrado. Clique em &quot;Cadastrar Imóvel&quot; para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

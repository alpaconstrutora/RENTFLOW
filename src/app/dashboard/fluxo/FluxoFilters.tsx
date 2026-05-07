'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Download } from 'lucide-react'

interface Props {
  months: string[]              // lista de billing_months disponíveis ex: ['2026-04-01', ...]
  properties: { id: string; name: string }[]
  transactions: { id: string; type: string; amount: number; due_date: string; billing_month: string; status: string; notes: string | null; property_name: string | null }[]
  currentYear?: string
}

export default function FluxoFilters({ months, properties, transactions, currentYear }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQueryString = useCallback((name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) { params.set(name, value) } else { params.delete(name) }
    return params.toString()
  }, [searchParams])

  const onChange = (name: string, value: string) => {
    router.push(pathname + '?' + createQueryString(name, value))
  }

  // I7: Gera e faz download do CSV com os dados filtrados
  const handleExportCsv = () => {
    const headers = ['Data Venc.', 'Tipo', 'Imóvel', 'Valor (R$)', 'Status', 'Descrição', 'Mês Competência']
    const rows = transactions.map(t => [
      t.due_date?.split('T')[0] ?? '',
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.property_name ?? '',
      Number(t.amount).toFixed(2).replace('.', ','),
      t.status,
      (t.notes ?? '').replace(/,/g, ';'),
      t.billing_month?.split('T')[0]?.slice(0, 7) ?? ''
    ])

    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rentflow_fluxo_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '10px 14px', borderRadius: '10px', color: 'white',
    outline: 'none', fontSize: '13px', cursor: 'pointer'
  }

  const onChangeYear = (year: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (year) { params.set('ano', year); params.delete('mes') } else { params.delete('ano') }
    router.push(pathname + '?' + params.toString())
  }

  const currentYearNum = new Date().getFullYear()
  const years = Array.from({ length: currentYearNum - 2010 + 1 }, (_, i) => currentYearNum - i)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {/* Filtro — Ano */}
      <select
        style={selectStyle}
        value={currentYear ?? ''}
        onChange={e => onChangeYear(e.target.value)}
      >
        <option value="">Todos os anos</option>
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>

      {/* I6: Filtro — Mês de competência */}
      <select
        style={selectStyle}
        value={searchParams.get('mes') ?? ''}
        onChange={e => onChange('mes', e.target.value)}
      >
        <option value="">Todos os meses</option>
        {months.map(m => {
          const [y, mo] = m.split('-')
          const label = new Date(parseInt(y), parseInt(mo) - 1, 1)
            .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
          return <option key={m} value={m.slice(0, 7)}>{label}</option>
        })}
      </select>

      {/* I6: Filtro — Imóvel */}
      <select
        style={selectStyle}
        value={searchParams.get('imovel') ?? ''}
        onChange={e => onChange('imovel', e.target.value)}
      >
        <option value="">Todos os imóveis</option>
        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {/* I6: Filtro — Tipo */}
      <select
        style={selectStyle}
        value={searchParams.get('tipo') ?? ''}
        onChange={e => onChange('tipo', e.target.value)}
      >
        <option value="">Receitas e Despesas</option>
        <option value="income">Somente Receitas</option>
        <option value="expense">Somente Despesas</option>
      </select>

      {/* I6: Filtro — Status */}
      <select
        style={selectStyle}
        value={searchParams.get('status') ?? ''}
        onChange={e => onChange('status', e.target.value)}
      >
        <option value="">Todos os status</option>
        <option value="pending">Pendentes</option>
        <option value="paid">Liquidadas</option>
        <option value="late">Em Atraso</option>
        <option value="cancelled">Canceladas</option>
      </select>

      {/* I7: Exportar CSV */}
      <button
        onClick={handleExportCsv}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
      >
        <Download size={14} />
        Exportar CSV
      </button>
    </div>
  )
}

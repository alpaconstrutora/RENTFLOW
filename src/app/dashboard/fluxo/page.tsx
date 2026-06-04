import { ShieldAlert, Filter } from 'lucide-react'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import NovaTransacaoBtn from './NovaTransacaoBtn'
import { Suspense } from 'react'
import FluxoFilters from './FluxoFilters'
import FluxoTable from './FluxoTable'

interface SearchParams { mes?: string; ano?: string; imovel?: string; tipo?: string; status?: string }

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

export default async function FluxoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedParams = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('transactions_view')
    .select('id, type, amount, net_amount, discount_amount, addition_amount, adjustment_notes, due_date, paid_date, billing_month, status, xmin, notes, is_auto_generated, property_id, property_name, tenant_name, recurrence_group_id, category_id, created_at')

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
    query = query.eq('status', resolvedParams.status)
  }

  const [
    { data: transactionsRaw, error },
    { data: properties },
    { data: leases },
    { data: categories },
    { data: allMonthsRaw },
  ] = await Promise.all([
    query.order('due_date', { ascending: false }).limit(500),
    supabase.from('properties').select('id, name').order('name').limit(200),
    supabase.from('leases').select('id, property_id, rent_value').eq('active', true).limit(200),
    supabase.from('categories').select('id, name, type').order('name').limit(100),
    supabase.from('transactions_view').select('billing_month').order('billing_month', { ascending: false }),
  ])

  const transactions = (transactionsRaw ?? []) as TransactionRow[]

  const uniqueMonths = [...new Set(
    allMonthsRaw?.map(t => t.billing_month?.split('T')[0] ?? '').filter(Boolean) ?? []
  )].sort().reverse()

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(0,229,155,0.15)', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: 600, margin: '0 0 4px' }}>↑ Recebido (filtro atual)</p>
          <p style={{ fontSize: '22px', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>{formatBRL(totalReceitas)}</p>
        </div>
        <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--danger-color)', fontWeight: 600, margin: '0 0 4px' }}>↓ Pago em Despesas</p>
          <p style={{ fontSize: '22px', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>{formatBRL(totalDespesas)}</p>
        </div>
        <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--warning-color)', fontWeight: 600, margin: '0 0 4px' }}>⏳ A Vencer / Pendente</p>
          <p style={{ fontSize: '22px', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>{formatBRL(totalPendente)}</p>
        </div>
      </div>

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

      <FluxoTable transactions={transactions} categories={categories || []} />
    </>
  )
}

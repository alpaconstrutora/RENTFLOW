import { notFound } from 'next/navigation'
import { createClientWithUser } from '../../../../utils/supabase/server'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Building2, FileText, ArrowUpRight, ArrowDownRight, CalendarClock } from 'lucide-react'

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

function formatBRL(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

function mesLabel(billing: string) {
  const [y, m] = billing.split('T')[0].split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[parseInt(m) - 1]}/${y}`
}

export default async function ImovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await createClientWithUser()
  if (!user) notFound()

  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
  const today = (todayStr as string) || new Date().toISOString().split('T')[0]
  const [yr] = today.split('-')
  const startOfYear = `${yr}-01-01`

  // Imóvel
  const { data: prop } = await supabase
    .from('properties')
    .select('id, name, type, status, expected_rent, purchase_value, address, notes, photo_url, zip_code, street, street_number, district, city, state')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!prop) notFound()

  // Contratos ativos e histórico
  const { data: leasesRaw } = await supabase
    .from('leases')
    .select('id, rent_value, start_date, end_date, due_day, active, adjustment_index, tenant:tenants(id, name, document, phone, email)')
    .eq('property_id', id)
    .order('created_at', { ascending: false })

  type LeaseRow = {
    id: string; rent_value: number; start_date: string; end_date: string | null
    due_day: number; active: boolean; adjustment_index: string | null
    tenant: { id: string; name: string; document: string | null; phone: string | null; email: string | null } | { id: string; name: string; document: string | null; phone: string | null; email: string | null }[] | null
  }
  const leases = leasesRaw as LeaseRow[] | null
  const activeLease = leases?.find(l => l.active) ?? null
  const activeTenant = activeLease?.tenant
    ? (Array.isArray(activeLease.tenant) ? activeLease.tenant[0] : activeLease.tenant)
    : null

  // Transações do imóvel — Invariante #13
  const { data: transactions } = await supabase
    .from('transactions_view')
    .select('id, type, amount, net_amount, status, billing_month, due_date, notes, is_auto_generated')
    .eq('property_id', id)
    .order('due_date', { ascending: false })
    .limit(50)

  // KPIs acumulados
  const paidTx = (transactions ?? []).filter(t => t.status === 'paid')
  const totalIncomeAll  = paidTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0)
  const totalExpenseAll = paidTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0)
  const netAll = totalIncomeAll - totalExpenseAll

  // KPIs YTD
  const ytdTx = paidTx.filter(t => t.billing_month && t.billing_month.split('T')[0] >= startOfYear)
  const incomeYtd  = ytdTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0)
  const expenseYtd = ytdTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.net_amount ?? t.amount), 0)
  const netYtd = incomeYtd - expenseYtd

  const purchaseValue = prop.purchase_value && prop.purchase_value > 0 ? prop.purchase_value : null
  const currentRent   = activeLease?.rent_value ?? prop.expected_rent ?? null
  const yieldAnual    = purchaseValue && currentRent ? (currentRent * 12 / purchaseValue * 100) : null
  const roiAcum       = purchaseValue ? (netAll / purchaseValue * 100) : null

  const addressLine = prop.street
    ? [prop.street, prop.street_number, prop.district, prop.city && prop.state ? `${prop.city} - ${prop.state}` : prop.city].filter(Boolean).join(', ')
    : prop.address

  const kpiCard: React.CSSProperties = {
    background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)',
    borderRadius: '14px', padding: '20px 22px',
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <Link href="/dashboard/imoveis" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Voltar para Imóveis
        </Link>
      </div>

      {/* Header do imóvel */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', alignItems: 'flex-start' }}>
        <div style={{ width: '100px', height: '100px', borderRadius: '16px', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {prop.photo_url
            ? <img src={prop.photo_url} alt={prop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Building2 size={36} color="var(--text-muted)" />
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', margin: 0 }}>{prop.name}</h1>
            <span style={{
              fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px',
              color: prop.status === 'rented' ? 'var(--success-color)' : 'var(--warning-color)',
              background: prop.status === 'rented' ? 'var(--success-bg)' : 'var(--warning-bg)',
            }}>
              {prop.status === 'rented' ? '● Locado' : '● Vago'}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 6px' }}>
            {TYPE_LABELS[prop.type] ?? prop.type}
            {addressLine ? ` · ${addressLine}` : ''}
          </p>
          {prop.notes && <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>{prop.notes}</p>}
        </div>
        <Link
          href={`/dashboard/imoveis`}
          style={{ fontSize: '13px', color: 'var(--accent-color)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px' }}
        >
          <FileText size={14} /> Relatório Mensal
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ ...kpiCard, borderColor: netYtd >= 0 ? 'rgba(99,102,241,0.3)' : 'rgba(255,50,50,0.3)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Resultado YTD ({yr})</p>
          <p style={{ fontSize: '22px', fontWeight: 700, color: netYtd >= 0 ? 'var(--accent-color)' : 'var(--danger-color)', margin: '0 0 4px' }}>{formatBRL(netYtd)}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Rec: {formatBRL(incomeYtd)} · Desp: {formatBRL(expenseYtd)}</p>
        </div>

        <div style={kpiCard}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>ROI Acumulado</p>
          <p style={{ fontSize: '22px', fontWeight: 700, color: roiAcum != null ? (roiAcum >= 0 ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-muted)', margin: '0 0 4px' }}>
            {roiAcum != null ? `${roiAcum.toFixed(2)}%` : '—'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            {purchaseValue ? `V. Compra: ${formatBRL(purchaseValue)}` : 'Adicionar valor de compra'}
          </p>
        </div>

        <div style={kpiCard}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Yield Anual</p>
          <p style={{ fontSize: '22px', fontWeight: 700, color: yieldAnual ? 'var(--accent-color)' : 'var(--text-muted)', margin: '0 0 4px' }}>
            {yieldAnual ? `${yieldAnual.toFixed(2)}%` : '—'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            {currentRent ? `${formatBRL(currentRent)}/mês` : 'Sem aluguel ativo'}
          </p>
        </div>

        <div style={kpiCard}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Lucro Total Histórico</p>
          <p style={{ fontSize: '22px', fontWeight: 700, color: netAll >= 0 ? 'var(--success-color)' : 'var(--danger-color)', margin: '0 0 4px' }}>{formatBRL(netAll)}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{paidTx.length} transações liquidadas</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
        {/* Locatário Ativo */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '22px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 16px', fontWeight: 600 }}>
            Locatário Ativo
          </h3>
          {activeTenant && activeLease ? (
            <>
              <p style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: '0 0 8px' }}>{activeTenant.name}</p>
              {activeTenant.document && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>CPF/CNPJ: {activeTenant.document}</p>}
              {activeTenant.email   && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{activeTenant.email}</p>}
              {activeTenant.phone   && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>{activeTenant.phone}</p>}
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>Início: <strong style={{ color: 'white' }}>{formatDate(activeLease.start_date)}</strong></span>
                <span>Venc. dia <strong style={{ color: 'white' }}>{String(activeLease.due_day).padStart(2, '0')}</strong></span>
                {activeLease.end_date && <span>Término: <strong style={{ color: 'white' }}>{formatDate(activeLease.end_date)}</strong></span>}
              </div>
              {activeLease.adjustment_index && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                  Índice: {activeLease.adjustment_index}
                </p>
              )}
              <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                <Link href="/dashboard/contratos" style={{ fontSize: '12px', color: 'var(--accent-color)', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px' }}>
                  Ver Contrato
                </Link>
                <Link href="/dashboard/inquilinos" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  Perfil do Inquilino
                </Link>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 12px' }}>Imóvel sem locatário ativo</p>
              <Link href="/dashboard/contratos" style={{ fontSize: '13px', color: 'var(--accent-color)', textDecoration: 'none' }}>
                Criar contrato →
              </Link>
            </div>
          )}
        </div>

        {/* Histórico de contratos */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '22px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 16px', fontWeight: 600 }}>
            Histórico de Contratos
          </h3>
          {leases && leases.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leases.slice(0, 5).map(l => {
                const t = l.tenant ? (Array.isArray(l.tenant) ? l.tenant[0] : l.tenant) : null
                return (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: `1px solid ${l.active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}` }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>{t?.name ?? 'Inquilino removido'}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatDate(l.start_date)} — {l.end_date ? formatDate(l.end_date) : 'Indeterminado'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success-color)' }}>{formatBRL(l.rent_value)}</span>
                      {l.active
                        ? <span style={{ display: 'block', fontSize: '11px', color: 'var(--accent-color)', fontWeight: 600 }}>● Vigente</span>
                        : <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>Encerrado</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Nenhum contrato registrado.</p>
          )}
        </div>
      </div>

      {/* Extrato de transações */}
      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '22px' }}>
        <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 16px', fontWeight: 600 }}>
          Últimas 50 Transações
        </h3>

        {transactions && transactions.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'left' }}>Descrição</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Competência</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Vencimento</th>
                <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'right' }}>Valor</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => {
                const net = Number(t.net_amount ?? t.amount)
                const isIncome = t.type === 'income'
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isIncome
                          ? <ArrowUpRight size={15} color="var(--success-color)" />
                          : <ArrowDownRight size={15} color="var(--danger-color)" />
                        }
                        <div>
                          <span style={{ color: 'white' }}>{t.notes || (isIncome ? 'Recebimento de Aluguel' : 'Despesa Operacional')}</span>
                          {t.is_auto_generated && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--accent-color)', background: 'rgba(99,102,241,0.12)', padding: '1px 5px', borderRadius: '4px' }}>Auto</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {t.billing_month ? mesLabel(t.billing_month) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CalendarClock size={12} />
                        {formatDate(t.due_date)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right', color: isIncome ? 'var(--success-color)' : 'var(--danger-color)' }}>
                      {isIncome ? '+' : '-'} {formatBRL(net)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {t.status === 'paid'    && <span style={{ fontSize: '12px', color: 'var(--success-color)', background: 'var(--success-bg)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>Liquidada</span>}
                      {t.status === 'pending' && <span style={{ fontSize: '12px', color: 'var(--warning-color)', background: 'var(--warning-bg)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>Pendente</span>}
                      {t.status === 'late'    && <span style={{ fontSize: '12px', color: 'var(--danger-color)', background: 'var(--danger-bg)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>Em Atraso</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Nenhuma transação registrada para este imóvel.</p>
        )}
      </div>
    </>
  )
}

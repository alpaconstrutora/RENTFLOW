import { FileText, CalendarClock, AlertTriangle, Bell } from 'lucide-react'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import LeaseButtonWithModal from './LeaseButtonWithModal'
import LeaseEditBtn from './LeaseEditBtn'
import LeaseDeleteBtn from './LeaseDeleteBtn'
import DistratoBtn from './DistratoBtn'
import RunBillingBtn from './RunBillingBtn'

interface LeaseRow {
  id: string
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
  property: { name: string } | null
  tenant: { name: string } | null
}

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

export default async function ContratosPage() {
  const supabase = await createClient()

  const [
    { data: leasesRaw },
    { data: rawProperties },
    { data: rawTenants },
    { data: rawLandlordProfiles },
  ] = await Promise.all([
    supabase
      .from('leases')
      .select(`id,rent_value,start_date,end_date,billing_start_date,due_day,active,adjustment_index,adjustment_period_months,next_adjustment_date,iptu_paid_by,condo_paid_by,landlord_profile_id,guarantee_type,property:properties(name),tenant:tenants(name)`)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('properties').select('id, name, status').limit(200),
    supabase.from('tenants').select('id, name').limit(200),
    supabase.from('landlord_profiles').select('id, name, person_type, document, is_default').order('is_default', { ascending: false }).order('name').limit(50),
  ])
  const leases = leasesRaw as LeaseRow[] | null

  const properties       = rawProperties       || []
  const tenants          = rawTenants          || []
  const landlordProfiles = rawLandlordProfiles || []

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Contratos de Locação</h1>
          <p className={styles.subtitle}>Supervisione os contratos. Acione manualmente a automação (RPA) para faturar todo portfólio no mês vigente.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <RunBillingBtn />
          <LeaseButtonWithModal properties={properties} tenants={tenants} landlordProfiles={landlordProfiles} />
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '16px', fontWeight: 500 }}>Vínculo Jurídico (Imóvel / Inquilino)</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Rentabilidade</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Vencimento</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Vigência</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Próx. Reajuste</th>
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {leases?.map((lease) => {
              const endDays = lease.end_date ? daysBetween(lease.end_date) : null
              const adjDays = lease.next_adjustment_date ? daysBetween(lease.next_adjustment_date) : null
              const showEndAlert = endDays !== null && endDays <= 60
              const showAdjAlert = adjDays !== null && adjDays <= 30

              return (
                <tr key={lease.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className={styles.iconWrapper} style={{ background: 'rgba(255, 204, 0, 0.05)', border: '1px solid rgba(255, 204, 0, 0.15)' }}>
                        <FileText size={18} color="#FFCC00" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{lease.property?.name}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>LOCATÁRIO: {lease.tenant?.name}</span>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CalendarClock size={14} />
                      Todo dia {String(lease.due_day).padStart(2, '0')}
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
                        style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FileText size={14} /> PDF
                      </a>
                      <LeaseEditBtn lease={lease} landlordProfiles={landlordProfiles} />
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

            {(!leases || leases.length === 0) && (
              <tr>
                <td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
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

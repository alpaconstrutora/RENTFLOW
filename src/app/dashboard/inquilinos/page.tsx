import { Users } from 'lucide-react'
import { redirect } from 'next/navigation'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import { getCurrentUserId } from '../../../utils/supabase/user'
import { startTimer, formatTimings } from '../../../utils/perf-debug'
import TenantButtonWithModal from './TenantButtonWithModal'
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

export default async function InquilinosPage() {
  const timer = startTimer()

  const userId = await getCurrentUserId()
  timer.mark('getCurrentUserId')
  if (!userId) redirect('/login')

  const supabase = await createClient()
  timer.mark('createClient')

  const { data: tenantsRaw } = await supabase
    .from('tenants')
    .select(`
      id, name, email, phone, document,
      type, birth_date, marital_status, profession, rg, nationality, monthly_income,
      zip_code, street, street_number, district, city, state, address_complement,
      photo_url, guarantor_name, guarantor_document, notes
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  timer.mark('query tenants')

  const tenants = (tenantsRaw ?? []) as TenantRow[]
  const perfReport = formatTimings(timer.records)

  function addressLine(t: TenantRow): string | null {
    if (t.street) {
      const parts = [t.street, t.street_number, t.district, t.city && t.state ? `${t.city} - ${t.state}` : t.city].filter(Boolean)
      return parts.join(', ')
    }
    return null
  }

  return (
    <>
      {/* DEBUG TIMING — remover após diagnóstico */}
      <div style={{ background: '#1e1b4b', border: '1px solid #6366f1', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '11px', fontFamily: 'monospace', color: '#c7d2fe' }}>
        ⏱ server render: {perfReport}
      </div>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Inquilinos</h1>
          <p className={styles.subtitle}>Cadastro de pessoas físicas e jurídicas da sua carteira.</p>
        </div>
        <div className={styles.actions}>
          <TenantButtonWithModal userId={userId} />
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '16px', fontWeight: 500 }}>Nome</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Documento</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Contato</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Endereço</th>
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(tenant => {
              const addr = addressLine(tenant)
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

                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{tenant.document || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}</span>
                      {tenant.guarantor_name && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fiador: {tenant.guarantor_name}</span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '16px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {tenant.email && <span style={{ color: 'var(--text-secondary)' }}>{tenant.email}</span>}
                      {tenant.phone && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{tenant.phone}</span>}
                      {!tenant.email && !tenant.phone && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                    </div>
                  </td>

                  <td style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                    {addr || <span style={{ fontStyle: 'italic' }}>—</span>}
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

            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
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

import { Users, Shield } from 'lucide-react'
import Link from 'next/link'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import LandlordProfilesList from './LandlordProfilesList'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('landlord_profiles')
    .select('id, person_type, name, document, email, phone, address, is_default')
    .order('is_default', { ascending: false })
    .order('created_at')

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Configurações</h1>
          <p className={styles.subtitle}>Perfis de locador — usados nos recibos e documentos gerados pelo sistema.</p>
        </div>
      </header>

      <div style={{ marginBottom: '28px', maxWidth: '700px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div className={styles.iconWrapper}>
            <Users size={18} color="var(--accent-color)" />
          </div>
          <div>
            <p style={{ fontWeight: 600, margin: 0 }}>Perfis de Locador</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Cada contrato pode usar um perfil diferente — útil para quem tem imóveis em CPF e CNPJ separados.
            </p>
          </div>
        </div>

        <LandlordProfilesList profiles={profiles ?? []} />
      </div>

      <Link href="/dashboard/configuracoes/auditoria" style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        maxWidth: '700px',
        padding: '20px 24px', borderRadius: '16px',
        border: '1px solid var(--border-color)', background: 'var(--card-bg)',
        textDecoration: 'none', color: 'white', transition: 'border-color 0.2s',
      }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={18} color="var(--accent-color)" />
        </div>
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 2px', fontSize: '14px' }}>Histórico de Auditoria</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Registro imutável de pagamentos, ajustes e ações realizadas no sistema.
          </p>
        </div>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '18px' }}>→</span>
      </Link>
    </>
  )
}

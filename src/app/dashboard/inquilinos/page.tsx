import { redirect } from 'next/navigation'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import { getCurrentUserId } from '../../../utils/supabase/user'
import TenantButtonWithModal from './TenantButtonWithModal'
import TenantTable from './TenantTable'

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
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const supabase = await createClient()

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

  const tenants = (tenantsRaw ?? []) as TenantRow[]

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Inquilinos</h1>
          <p className={styles.subtitle}>Cadastro de pessoas físicas e jurídicas da sua carteira.</p>
        </div>
        <div className={styles.actions}>
          <TenantButtonWithModal userId={userId} />
        </div>
      </header>

      <TenantTable tenants={tenants} userId={userId} />
    </>
  )
}

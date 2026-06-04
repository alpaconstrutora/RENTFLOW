import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import LeaseButtonWithModal from './LeaseButtonWithModal'
import RunBillingBtn from './RunBillingBtn'
import TemplateManagerModal from './TemplateManagerModal'
import DynamicLeaseWizardModal from './DynamicLeaseWizardModal'
import LeaseTable from './LeaseTable'

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
      .select(`id,code,rent_value,start_date,end_date,billing_start_date,due_day,active,adjustment_index,adjustment_period_months,next_adjustment_date,iptu_paid_by,condo_paid_by,landlord_profile_id,guarantee_type,property_id,tenant_id,property:properties(name),tenant:tenants(name),transactions(id),contract_instances(id, status)`)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('properties').select('id, name, status, type, address, zip_code, street, street_number, district, city, state').limit(200),
    supabase.from('tenants').select('id, name, document, rg, email, phone, birth_date, marital_status, profession, nationality, zip_code, street, street_number, district, city, state, address_complement, guarantor_name, guarantor_document').limit(200),
    supabase.from('landlord_profiles').select('id, name, person_type, document, is_default, email, phone, address').order('is_default', { ascending: false }).order('name').limit(50),
  ])
  const leases = leasesRaw as LeaseRow[] | null

  const properties       = rawProperties       || []
  const tenants          = rawTenants          || []
  const landlordProfiles = rawLandlordProfiles || []

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Contratos de Locação</h1>
          <p className={styles.subtitle}>Supervisione os contratos. Acione manualmente a automação (RPA) para faturar todo portfólio no mês vigente.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <TemplateManagerModal />
          <RunBillingBtn />
          <DynamicLeaseWizardModal properties={properties} tenants={tenants} landlordProfiles={landlordProfiles} />
          <LeaseButtonWithModal properties={properties} tenants={tenants} landlordProfiles={landlordProfiles} />
        </div>
      </header>

      <LeaseTable 
        leases={leases} 
        landlordProfiles={landlordProfiles} 
        properties={properties} 
        tenants={tenants} 
      />
    </>
  )
}

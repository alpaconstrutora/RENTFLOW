import { redirect } from 'next/navigation'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import { getCurrentUserId } from '../../../utils/supabase/user'
import ImovelButtonWithModal from './ImovelButtonWithModal'
import ImovelTable from './ImovelTable'

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

export default async function ImoveisPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const supabase = await createClient()

  const [{ data: propertiesRaw }, { data: profitSummary }] = await Promise.all([
    supabase
      .from('properties')
      .select(`
        id, name, type, status, expected_rent, purchase_value,
        address, notes, photo_url,
        zip_code, street, street_number, district, city, state,
        leases ( rent_value, active )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase.rpc('get_property_profit_summary'),
  ])

  const properties = (propertiesRaw ?? []) as PropertyRow[]

  const profitMap: Record<string, number>  = {}
  const monthsMap: Record<string, number>  = {}
  for (const r of profitSummary ?? []) {
    profitMap[r.property_id] = Number(r.total_profit)
    monthsMap[r.property_id] = r.months_count
  }

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Meus Imóveis</h1>
          <p className={styles.subtitle}>Portfólio físico com ROI, Yield e status de ocupação em tempo real.</p>
        </div>
        <div className={styles.actions}>
          <ImovelButtonWithModal userId={userId} />
        </div>
      </header>

      <ImovelTable 
        properties={properties} 
        profitMap={profitMap} 
        monthsMap={monthsMap} 
        userId={userId} 
      />
    </>
  )
}

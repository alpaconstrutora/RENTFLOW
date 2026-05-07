'use server'

import { createClient } from '../../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function savePjTaxConfigAction(formData: FormData): Promise<string | null> {
  const supabase = await createClient()

  const parse = (key: string) => parseFloat((formData.get(key) as string)?.replace(',', '.') || '0') / 100

  const pis    = parse('pis_rate')
  const cofins = parse('cofins_rate')
  const csll   = parse('csll_rate')
  const irpj   = parse('irpj_rate')
  const base   = parseFloat((formData.get('presumed_base_factor') as string)?.replace(',', '.') || '32') / 100

  const { error } = await supabase.rpc('upsert_pj_tax_config', {
    p_pis_rate:             pis,
    p_cofins_rate:          cofins,
    p_csll_rate:            csll,
    p_irpj_rate:            irpj,
    p_presumed_base_factor: base,
  })

  if (error) return error.message
  revalidatePath('/dashboard/impostos/lucro-presumido')
  return null
}

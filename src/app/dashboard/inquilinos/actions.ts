'use server'

import { createClient } from '../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

function buildAddress(street: string | null, number: string | null, district: string | null, city: string | null, state: string | null): string | null {
  const parts = [street, number, district, city && state ? `${city} - ${state}` : city].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export async function createTenantAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    const name     = formData.get('name')     as string
    const email    = (formData.get('email')   as string) || null
    const phone    = (formData.get('phone')   as string) || null
    const document = (formData.get('document') as string) || null
    const type     = (formData.get('type')    as string) || 'individual'

    const zip_code           = (formData.get('zip_code')           as string) || null
    const street             = (formData.get('street')             as string) || null
    const street_number      = (formData.get('street_number')      as string) || null
    const district           = (formData.get('district')           as string) || null
    const city               = (formData.get('city')               as string) || null
    const state              = (formData.get('state')              as string) || null
    const address_complement = (formData.get('address_complement') as string) || null

    const birth_date     = (formData.get('birth_date')     as string) || null
    const marital_status = (formData.get('marital_status') as string) || null
    const profession     = (formData.get('profession')     as string) || null
    const rg             = (formData.get('rg')             as string) || null
    const nationality    = (formData.get('nationality')    as string) || null
    const monthlyRaw     = formData.get('monthly_income')  as string
    const monthly_income = monthlyRaw ? parseFloat(monthlyRaw) : null

    const photo_url          = (formData.get('photo_url')          as string) || null
    const guarantor_name     = (formData.get('guarantor_name')     as string) || null
    const guarantor_document = (formData.get('guarantor_document') as string) || null

    const basePayload: Record<string, unknown> = {
      user_id: user.id, name, email, phone, document,
    }

    // Columns from migration 20260425000000 — omitted if not yet applied
    if (zip_code !== null || street !== null || city !== null) {
      const address = buildAddress(street, street_number, district, city, state)
      Object.assign(basePayload, { type, zip_code, street, street_number, district, city, state, address_complement, address })
    }

    if (birth_date || profession || rg)
      Object.assign(basePayload, { birth_date: birth_date || null, marital_status: marital_status || null, profession, rg, nationality, monthly_income })

    // Columns from migration 20260425000001 — omitted if not yet applied
    if (photo_url !== null || guarantor_name !== null)
      Object.assign(basePayload, { photo_url, guarantor_name, guarantor_document })

    const notes = (formData.get('notes') as string) || null
    if (notes !== null) Object.assign(basePayload, { notes })

    const { error } = await supabase.from('tenants').insert(basePayload)
    if (error) return error.message

    revalidatePath('/dashboard/inquilinos')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro desconhecido'
  }
}

export async function updateTenantAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    const id       = formData.get('id')       as string
    const name     = formData.get('name')     as string
    const email    = (formData.get('email')   as string) || null
    const phone    = (formData.get('phone')   as string) || null
    const document = (formData.get('document') as string) || null
    const type     = (formData.get('type')    as string) || 'individual'

    const zip_code           = (formData.get('zip_code')           as string) || null
    const street             = (formData.get('street')             as string) || null
    const street_number      = (formData.get('street_number')      as string) || null
    const district           = (formData.get('district')           as string) || null
    const city               = (formData.get('city')               as string) || null
    const state              = (formData.get('state')              as string) || null
    const address_complement = (formData.get('address_complement') as string) || null

    const birth_date     = (formData.get('birth_date')     as string) || null
    const marital_status = (formData.get('marital_status') as string) || null
    const profession     = (formData.get('profession')     as string) || null
    const rg             = (formData.get('rg')             as string) || null
    const nationality    = (formData.get('nationality')    as string) || null
    const monthlyRaw     = formData.get('monthly_income')  as string
    const monthly_income = monthlyRaw ? parseFloat(monthlyRaw) : null

    const photo_url          = (formData.get('photo_url')          as string) || null
    const guarantor_name     = (formData.get('guarantor_name')     as string) || null
    const guarantor_document = (formData.get('guarantor_document') as string) || null

    const updatePayload: Record<string, unknown> = { name, email, phone, document }

    if (zip_code !== null || street !== null || city !== null) {
      const address = buildAddress(street, street_number, district, city, state)
      Object.assign(updatePayload, { type, zip_code, street, street_number, district, city, state, address_complement, address })
    }

    if (birth_date || profession || rg)
      Object.assign(updatePayload, { birth_date: birth_date || null, marital_status: marital_status || null, profession, rg, nationality, monthly_income })

    if (photo_url !== null || guarantor_name !== null)
      Object.assign(updatePayload, { photo_url, guarantor_name, guarantor_document })

    const notes = (formData.get('notes') as string) || null
    if (notes !== null) Object.assign(updatePayload, { notes })

    const { error } = await supabase.from('tenants')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message

    revalidatePath('/dashboard/inquilinos')
    revalidatePath('/dashboard/contratos')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro desconhecido'
  }
}

export async function deleteTenantAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    const { error } = await supabase.from('tenants')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message

    revalidatePath('/dashboard/inquilinos')
    revalidatePath('/dashboard/contratos')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro ao deletar inquilino'
  }
}

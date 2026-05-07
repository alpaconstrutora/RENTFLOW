'use server'

import { createClient } from '../../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertLandlordProfileAction(formData: FormData): Promise<string | null> {
  const supabase = await createClient()

  const id       = (formData.get('id') as string | null) || null
  const name     = (formData.get('name') as string)?.trim()
  const document = (formData.get('document') as string)?.trim() || ''
  const email    = (formData.get('email') as string)?.trim() || ''
  const phone    = (formData.get('phone') as string)?.trim() || ''
  const address  = (formData.get('address') as string)?.trim() || ''
  const personType = (formData.get('person_type') as string) || 'pf'
  const isDefault  = formData.get('is_default') === 'true'

  if (!name) return 'Nome é obrigatório.'

  const { error } = await supabase.rpc('upsert_landlord_profile', {
    p_id:          id,
    p_person_type: personType,
    p_name:        name,
    p_document:    document,
    p_email:       email,
    p_phone:       phone,
    p_address:     address,
    p_is_default:  isDefault,
  })

  if (error) return error.message
  revalidatePath('/dashboard/configuracoes')
  return null
}

export async function setDefaultProfileAction(id: string): Promise<string | null> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_default_landlord_profile', { p_id: id })
  if (error) return error.message
  revalidatePath('/dashboard/configuracoes')
  return null
}

export async function deleteLandlordProfileAction(id: string): Promise<string | null> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_landlord_profile', { p_id: id })
  if (error) return error.message
  revalidatePath('/dashboard/configuracoes')
  return null
}

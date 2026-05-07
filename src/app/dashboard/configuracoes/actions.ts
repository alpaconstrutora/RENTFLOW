'use server'

import { createClient } from '../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveProfileAction(formData: FormData): Promise<string | null> {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    data: {
      name:     (formData.get('name') as string).trim() || null,
      document: (formData.get('document') as string).trim() || null,
      phone:    (formData.get('phone') as string).trim() || null,
      address:  (formData.get('address') as string).trim() || null,
    }
  })

  if (error) return error.message

  revalidatePath('/dashboard/configuracoes')
  return null
}

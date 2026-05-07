'use server'

import { createClient } from '../../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

function buildAddress(street: string | null, number: string | null, district: string | null, city: string | null, state: string | null): string | null {
  const parts = [street, number, district, city && state ? `${city} - ${state}` : city].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export async function createPropertyAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const photo_url = (formData.get('photo_url') as string) || null

    const expectedRentRaw = formData.get('expected_rent') as string
    const expectedRent = expectedRentRaw ? parseFloat(expectedRentRaw) : null
    if (expectedRent !== null && (isNaN(expectedRent) || expectedRent <= 0))
      return 'Aluguel esperado deve ser positivo.'

    const purchaseValueRaw = formData.get('purchase_value') as string
    const purchaseValue = purchaseValueRaw ? parseFloat(purchaseValueRaw) : null
    if (purchaseValue !== null && (isNaN(purchaseValue) || purchaseValue <= 0))
      return 'Valor de compra deve ser positivo.'

    const zip_code      = (formData.get('zip_code')      as string) || null
    const street        = (formData.get('street')        as string) || null
    const street_number = (formData.get('street_number') as string) || null
    const district      = (formData.get('district')      as string) || null
    const city          = (formData.get('city')          as string) || null
    const state         = (formData.get('state')         as string) || null
    const notes         = (formData.get('notes')         as string) || null

    const address = buildAddress(street, street_number, district, city, state)

    const basePayload: Record<string, unknown> = {
      user_id: user.id, name, type, photo_url,
      status: 'vacant',
      expected_rent: expectedRent,
      purchase_value: purchaseValue,
      address, notes,
    }
    // Colunas da migration 20260424000003 — omitidas se ainda não existirem
    if (zip_code !== null || street !== null || city !== null)
      Object.assign(basePayload, { zip_code, street, street_number, district, city, state })

    const { error } = await supabase.from('properties').insert(basePayload)

    if (error) return error.message
    revalidatePath('/dashboard/imoveis')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro desconhecido'
  }
}

export async function updatePropertyAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    const id   = formData.get('id')   as string
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const photo_url = (formData.get('photo_url') as string) || null

    const expectedRentRaw = formData.get('expected_rent') as string
    const expectedRent = expectedRentRaw ? parseFloat(expectedRentRaw) : null
    if (expectedRent !== null && (isNaN(expectedRent) || expectedRent <= 0))
      return 'Aluguel esperado deve ser positivo.'

    const purchaseValueRaw = formData.get('purchase_value') as string
    const purchaseValue = purchaseValueRaw ? parseFloat(purchaseValueRaw) : null
    if (purchaseValue !== null && (isNaN(purchaseValue) || purchaseValue <= 0))
      return 'Valor de compra deve ser positivo.'

    const zip_code      = (formData.get('zip_code')      as string) || null
    const street        = (formData.get('street')        as string) || null
    const street_number = (formData.get('street_number') as string) || null
    const district      = (formData.get('district')      as string) || null
    const city          = (formData.get('city')          as string) || null
    const state         = (formData.get('state')         as string) || null
    const notes         = (formData.get('notes')         as string) || null

    const address = buildAddress(street, street_number, district, city, state)

    const updatePayload: Record<string, unknown> = {
      name, type, photo_url,
      expected_rent: expectedRent,
      purchase_value: purchaseValue,
      address, notes,
    }
    if (zip_code !== null || street !== null || city !== null)
      Object.assign(updatePayload, { zip_code, street, street_number, district, city, state })

    const { error } = await supabase.from('properties')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message
    revalidatePath('/dashboard/imoveis')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro desconhecido'
  }
}

export async function deletePropertyAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    const { count: paidCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', id).eq('user_id', user.id).eq('status', 'paid')

    if (paidCount && paidCount > 0)
      return `INTERLOCK FINANCEIRO: Este ativo possui ${paidCount} transação(ões) liquidada(s). Cancele as faturas antes de excluir.`

    const { count: activeLeaseCount } = await supabase
      .from('leases')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', id).eq('user_id', user.id).eq('active', true)

    if (activeLeaseCount && activeLeaseCount > 0)
      return `INTERLOCK CONTRATUAL: Este imóvel possui ${activeLeaseCount} contrato(s) ativo(s). Encerre os contratos antes de excluir.`

    const { error } = await supabase.from('properties').delete().eq('id', id).eq('user_id', user.id)
    if (error) return error.message

    revalidatePath('/dashboard/imoveis')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/contratos')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro ao deletar o imóvel'
  }
}

export const createProperty = createPropertyAction

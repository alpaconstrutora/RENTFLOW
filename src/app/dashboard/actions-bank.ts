'use server'

import { createClient } from '../../utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BankAccount {
  id: string
  user_id: string
  tenant_id: string | null
  landlord_profile_id: string | null
  bank_name: string
  bank_code: string
  branch: string
  branch_digit: string | null
  account: string
  account_digit: string | null
  account_type: 'checking' | 'savings' | 'payment'
  holder_name: string
  holder_document: string
  pix_key: string | null
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null
  is_main_account: boolean
  is_main_pix: boolean
  is_active: boolean
  notes: string | null
  created_at: string
}

export async function getBankAccountsAction(ownerType: 'tenant' | 'landlord', ownerId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Erro de Autenticação.' }

    const query = supabase.from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (ownerType === 'tenant') {
      query.eq('tenant_id', ownerId)
    } else {
      query.eq('landlord_profile_id', ownerId)
    }

    const { data, error } = await query.order('is_main_account', { ascending: false }).order('created_at')
    if (error) return { error: error.message }
    return { data: data as BankAccount[] }
  } catch (err) {
    return { error: (err as Error).message || 'Erro ao buscar contas bancárias' }
  }
}

export async function createBankAccountAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    const ownerType = formData.get('owner_type') as 'tenant' | 'landlord'
    const ownerId   = formData.get('owner_id')   as string

    const bank_name       = formData.get('bank_name')       as string
    const bank_code       = formData.get('bank_code')       as string
    const branch          = formData.get('branch')          as string
    const branch_digit    = (formData.get('branch_digit')    as string) || null
    const account         = formData.get('account')         as string
    const account_digit   = (formData.get('account_digit')   as string) || null
    const account_type    = (formData.get('account_type')    as string || 'checking') as 'checking' | 'savings' | 'payment'
    const holder_name     = formData.get('holder_name')     as string
    const holder_document = formData.get('holder_document') as string
    const pix_key         = (formData.get('pix_key')         as string) || null
    const pix_key_type    = (formData.get('pix_key_type')    as string || null) as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null
    const is_main_account = formData.get('is_main_account') === 'true'
    const is_main_pix     = formData.get('is_main_pix')     === 'true'
    const notes           = (formData.get('notes')           as string) || null

    const payload: Record<string, unknown> = {
      user_id: user.id,
      bank_name,
      bank_code,
      branch,
      branch_digit,
      account,
      account_digit,
      account_type,
      holder_name,
      holder_document,
      pix_key,
      pix_key_type,
      is_main_account,
      is_main_pix,
      is_active: true,
      notes,
    }

    if (ownerType === 'tenant') {
      payload.tenant_id = ownerId
    } else {
      payload.landlord_profile_id = ownerId
    }

    // Lógica defensiva para garantir a constraint atômica e desmarcar outras contas principais se esta for principal
    if (is_main_account) {
      const updateQuery = supabase.from('bank_accounts')
        .update({ is_main_account: false })
        .eq('user_id', user.id)
      
      if (ownerType === 'tenant') {
        await updateQuery.eq('tenant_id', ownerId)
      } else {
        await updateQuery.eq('landlord_profile_id', ownerId)
      }
    }

    if (is_main_pix) {
      const updateQuery = supabase.from('bank_accounts')
        .update({ is_main_pix: false })
        .eq('user_id', user.id)
      
      if (ownerType === 'tenant') {
        await updateQuery.eq('tenant_id', ownerId)
      } else {
        await updateQuery.eq('landlord_profile_id', ownerId)
      }
    }

    const { error } = await supabase.from('bank_accounts').insert(payload)
    if (error) return error.message

    revalidatePath('/dashboard/inquilinos')
    revalidatePath('/dashboard/configuracoes')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro desconhecido ao criar conta'
  }
}

export async function deleteBankAccountAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    // Desativa a conta logicamente (ou exclui física, no RentFlow podemos deletar fisicamente ou marcar is_active = false)
    // Para respeitar a simplicidade e a integridade de outras consultas, faremos deleção física já que não há faturamento direto com chaves estrangeiras de bank_accounts em transações.
    const { error } = await supabase.from('bank_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return error.message

    revalidatePath('/dashboard/inquilinos')
    revalidatePath('/dashboard/configuracoes')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro ao deletar conta'
  }
}

export async function toggleMainBankAccountAction(id: string, type: 'account' | 'pix') {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Erro de Autenticação.'

    // 1. Busca a conta bancária para descobrir a quem pertence
    const { data: acc, error: fetchError } = await supabase.from('bank_accounts')
      .select('tenant_id, landlord_profile_id, is_main_account, is_main_pix')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !acc) return 'Conta bancária não encontrada.'

    const ownerId = acc.tenant_id || acc.landlord_profile_id
    const ownerCol = acc.tenant_id ? 'tenant_id' : 'landlord_profile_id'

    if (type === 'account') {
      const nextVal = !acc.is_main_account
      if (nextVal) {
        // Zera as outras primeiro
        await supabase.from('bank_accounts')
          .update({ is_main_account: false })
          .eq('user_id', user.id)
          .eq(ownerCol, ownerId)
      }
      
      const { error } = await supabase.from('bank_accounts')
        .update({ is_main_account: nextVal })
        .eq('id', id)
        .eq('user_id', user.id)
      
      if (error) return error.message
    } else {
      const nextVal = !acc.is_main_pix
      if (nextVal) {
        // Zera as outras primeiro
        await supabase.from('bank_accounts')
          .update({ is_main_pix: false })
          .eq('user_id', user.id)
          .eq(ownerCol, ownerId)
      }
      
      const { error } = await supabase.from('bank_accounts')
        .update({ is_main_pix: nextVal })
        .eq('id', id)
        .eq('user_id', user.id)
      
      if (error) return error.message
    }

    revalidatePath('/dashboard/inquilinos')
    revalidatePath('/dashboard/configuracoes')
    return null
  } catch (err) {
    return (err as Error).message || 'Erro ao alternar principal'
  }
}

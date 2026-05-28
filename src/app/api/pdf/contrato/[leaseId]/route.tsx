import { NextRequest } from 'next/server'
import { createClient } from '../../../../../utils/supabase/server'
import { generateContratoPdfBuffer, buildContratoPdfData } from '../../../../../lib/pdf/generateContratoPdfBuffer'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ leaseId: string }> }
) {
  const { leaseId } = await context.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autorizado', { status: 401 })

  const { data: lease } = await supabase
    .from('leases')
    .select('id, rent_value, start_date, end_date, due_day, adjustment_index, adjustment_period_months, property_id, tenant_id, landlord_profile_id, guarantee_type, iptu_paid_by, condo_paid_by')
    .eq('id', leaseId)
    .single()

  if (!lease) return new Response('Contrato não encontrado', { status: 404 })

  const [{ data: propertyRaw }, { data: tenantRaw }, { data: landlordProfileRaw }] = await Promise.all([
    supabase.from('properties').select('name, address, city, state, type').eq('id', lease.property_id).single(),
    supabase.from('tenants').select('name, document, email, phone, street, street_number, district, city, state, guarantor_name, guarantor_document').eq('id', lease.tenant_id).single(),
    lease.landlord_profile_id
      ? supabase.from('landlord_profiles').select('id, name, document, phone, address').eq('id', lease.landlord_profile_id).single()
      : supabase.from('landlord_profiles').select('id, name, document, phone, address').eq('user_id', user.id).eq('is_default', true).maybeSingle(),
  ])

  const landlordProfileId = lease.landlord_profile_id || (landlordProfileRaw as { id?: string } | null)?.id || null
  let bankAccount = null
  if (landlordProfileId) {
    const { data: bankAccRaw } = await supabase
      .from('bank_accounts')
      .select('bank_name, bank_code, branch, branch_digit, account, account_digit, account_type, holder_name, holder_document, pix_key, pix_key_type')
      .eq('landlord_profile_id', landlordProfileId)
      .eq('is_main_account', true)
      .eq('is_active', true)
      .maybeSingle()
    bankAccount = bankAccRaw
  }

  const meta = user.user_metadata as { name?: string; phone?: string; document?: string; address?: string }
  const ownerProfile = landlordProfileRaw as { name: string; document: string | null; phone: string | null; address: string | null } | null

  const pdfData = buildContratoPdfData({
    leaseId,
    lease,
    property: propertyRaw as Parameters<typeof buildContratoPdfData>[0]['property'],
    tenant: tenantRaw as Parameters<typeof buildContratoPdfData>[0]['tenant'],
    owner: {
      name:     ownerProfile?.name     ?? meta.name     ?? user.email ?? '—',
      document: ownerProfile?.document ?? meta.document ?? null,
      phone:    ownerProfile?.phone    ?? meta.phone    ?? null,
      address:  ownerProfile?.address  ?? meta.address  ?? null,
    },
    bankAccount: bankAccount as Parameters<typeof buildContratoPdfData>[0]['bankAccount']
  })

  const buffer = await generateContratoPdfBuffer(pdfData)
  const contractNum = leaseId.split('-')[0].toLowerCase()

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contrato-${contractNum}.pdf"`,
    },
  })
}

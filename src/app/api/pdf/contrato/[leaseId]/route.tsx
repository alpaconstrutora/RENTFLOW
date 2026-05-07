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
    .select('id, rent_value, start_date, end_date, due_day, adjustment_index, adjustment_period_months, property_id, tenant_id')
    .eq('id', leaseId)
    .single()

  if (!lease) return new Response('Contrato não encontrado', { status: 404 })

  const [{ data: propertyRaw }, { data: tenantRaw }] = await Promise.all([
    supabase.from('properties').select('name, address, city, state').eq('id', lease.property_id).single(),
    supabase.from('tenants').select('name, document, email, phone, street, street_number, district, city, state').eq('id', lease.tenant_id).single(),
  ])

  const meta = user.user_metadata as { name?: string; phone?: string; document?: string; address?: string }

  const pdfData = buildContratoPdfData({
    leaseId,
    lease,
    property: propertyRaw as Parameters<typeof buildContratoPdfData>[0]['property'],
    tenant: tenantRaw as Parameters<typeof buildContratoPdfData>[0]['tenant'],
    owner: {
      name:     meta.name     ?? user.email ?? '—',
      document: meta.document ?? null,
      phone:    meta.phone    ?? null,
      address:  meta.address  ?? null,
    },
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

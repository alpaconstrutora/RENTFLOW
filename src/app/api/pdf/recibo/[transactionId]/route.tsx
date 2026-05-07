import { NextRequest } from 'next/server'
import { createClient } from '../../../../../utils/supabase/server'
import { ReciboPDF, generateReciboPDF } from '../../../../../lib/pdf/recibo'

export { ReciboPDF }

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ transactionId: string }> }
) {
  const { transactionId } = await context.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autorizado', { status: 401 })

  const { data: tx } = await supabase
    .from('transactions_view')
    .select('id, type, amount, discount_amount, addition_amount, net_amount, paid_date, billing_month, notes, lease_id, property_id, status')
    .eq('id', transactionId)
    .eq('type', 'income')
    .eq('status', 'paid')
    .single()

  if (!tx) return new Response('Recibo não encontrado', { status: 404 })

  const { data: propertyRaw } = await supabase
    .from('properties').select('name, address').eq('id', tx.property_id).single()

  const property = propertyRaw as { name: string; address: string | null } | null
  const meta = user.user_metadata as { name?: string; phone?: string; document?: string; address?: string }

  let tenant: { name: string; document: string | null; email: string | null; phone: string | null } | null = null
  if (tx.lease_id) {
    const { data: lease } = await supabase
      .from('leases')
      .select('tenant:tenants(name, document, email, phone)')
      .eq('id', tx.lease_id)
      .single()
    if (lease?.tenant) {
      const raw = Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant
      if (raw) tenant = raw as { name: string; document: string | null; email: string | null; phone: string | null }
    }
  }

  const cidadeData = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const buffer = await generateReciboPDF({
    tx: tx as Parameters<typeof generateReciboPDF>[0]['tx'],
    property,
    tenant,
    owner: {
      name:     meta.name     ?? user.email ?? '—',
      phone:    meta.phone    ?? null,
      document: meta.document ?? null,
      address:  meta.address  ?? null,
    },
    cidadeData,
  })

  const receiptNum = transactionId.split('-')[0].toLowerCase()
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${receiptNum}.pdf"`,
    },
  })
}

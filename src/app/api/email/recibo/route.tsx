import { NextRequest } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { getResend, FROM_EMAIL } from '../../../../lib/email/client'
import { reciboEmailHtml, reciboEmailSubject } from '../../../../lib/email/templates/recibo'
import { generateReciboPDF } from '../../../../lib/pdf/recibo'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const transactionId: string | undefined = body?.transactionId
  if (!transactionId) return Response.json({ error: 'transactionId obrigatório.' }, { status: 400 })

  // ── Buscar transação (apenas income paid do próprio usuário) ──────
  const { data: tx } = await supabase
    .from('transactions_view')
    .select('id, type, amount, discount_amount, addition_amount, net_amount, paid_date, billing_month, notes, lease_id, property_id, status, user_id')
    .eq('id', transactionId)
    .eq('type', 'income')
    .eq('status', 'paid')
    .eq('user_id', user.id)
    .single()

  if (!tx) return Response.json({ error: 'Recibo não encontrado ou não liquidado.' }, { status: 404 })

  // ── Imóvel ────────────────────────────────────────────────────────
  const { data: propertyRaw } = await supabase
    .from('properties')
    .select('name, address')
    .eq('id', tx.property_id)
    .single()
  const property = propertyRaw as { name: string; address: string | null } | null

  // ── Inquilino (via contrato) ──────────────────────────────────────
  type TenantInfo = { name: string; document: string | null; email: string | null; phone: string | null }
  let tenant: TenantInfo | null = null
  if (tx.lease_id) {
    const { data: lease } = await supabase
      .from('leases')
      .select('tenant:tenants(name, document, email, phone)')
      .eq('id', tx.lease_id)
      .single()
    if (lease?.tenant) {
      const raw = Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant
      if (raw) tenant = raw as TenantInfo
    }
  }

  if (!tenant?.email) {
    return Response.json(
      { error: 'Inquilino não tem e-mail cadastrado. Adicione o e-mail na ficha do inquilino.' },
      { status: 422 },
    )
  }

  // ── Locador ───────────────────────────────────────────────────────
  const meta = user.user_metadata as { name?: string; phone?: string; document?: string; address?: string }
  const owner = {
    name:     meta.name     ?? user.email ?? '—',
    phone:    meta.phone    ?? null,
    document: meta.document ?? null,
    address:  meta.address  ?? null,
  }

  // ── Gerar PDF ────────────────────────────────────────────────────
  const cidadeData = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateReciboPDF({
      tx: tx as Parameters<typeof generateReciboPDF>[0]['tx'],
      property,
      tenant,
      owner,
      cidadeData,
    })
  } catch {
    return Response.json({ error: 'Falha ao gerar o PDF do recibo.' }, { status: 500 })
  }

  // ── Enviar e-mail via Resend ─────────────────────────────────────
  const emailData = {
    transactionId,
    tenantName:      tenant.name,
    propertyName:    property?.name   ?? '—',
    propertyAddress: property?.address ?? null,
    netAmount:       Number(tx.net_amount ?? tx.amount),
    billingMonth:    tx.billing_month,
    paidDate:        tx.paid_date,
    ownerName:       owner.name,
  }

  const receiptNum = transactionId.split('-')[0].toLowerCase()

  try {
    const resend = getResend()
    const { error: sendError } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      tenant.email,
      subject: reciboEmailSubject(emailData),
      html:    reciboEmailHtml(emailData),
      attachments: [{
        filename: `recibo-${receiptNum}.pdf`,
        content:  pdfBuffer,
      }],
    })

    if (sendError) {
      return Response.json({ error: sendError.message }, { status: 502 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao enviar e-mail.'
    return Response.json({ error: msg }, { status: 500 })
  }

  return Response.json({ ok: true, sentTo: tenant.email })
}

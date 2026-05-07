import { notFound } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import PrintBtn from './PrintBtn'

function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais'
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function grupo(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cem'
    const c = Math.floor(n / 100)
    const resto = n % 100
    const d = Math.floor(resto / 10)
    const u = resto % 10
    const p: string[] = []
    if (c > 0) p.push(centenas[c])
    if (resto >= 10 && resto <= 19) p.push(especiais[resto - 10])
    else { if (d > 0) p.push(dezenas[d]); if (u > 0) p.push(unidades[u]) }
    return p.join(' e ')
  }

  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)
  const partes: string[] = []
  const milhoes = Math.floor(inteiro / 1000000)
  if (milhoes > 0) partes.push(grupo(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'))
  const milhares = Math.floor((inteiro % 1000000) / 1000)
  if (milhares > 0) partes.push(grupo(milhares) + ' mil')
  const resto = inteiro % 1000
  if (resto > 0) partes.push(grupo(resto))
  let resultado = partes.join(' e ')
  if (inteiro === 1) resultado += ' real'
  else if (inteiro > 1) resultado += ' reais'
  if (centavos > 0) {
    if (inteiro > 0) resultado += ' e '
    resultado += grupo(centavos) + (centavos === 1 ? ' centavo' : ' centavos')
  }
  return resultado
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

function mesAno(billing: string | null) {
  if (!billing) return '—'
  const [y, m] = billing.split('T')[0].split('-')
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${meses[parseInt(m) - 1]} / ${y}`
}

export default async function ReciboPage({ params }: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: tx } = await supabase
    .from('transactions_view')
    .select('id, type, amount, discount_amount, addition_amount, net_amount, paid_date, billing_month, notes, lease_id, property_id, status')
    .eq('id', transactionId)
    .eq('type', 'income')
    .eq('status', 'paid')
    .single()

  if (!tx) notFound()

  const netAmount = Number(tx.net_amount ?? tx.amount)
  const receiptNumber = transactionId.split('-')[0].toUpperCase()

  const { data: propertyRaw } = await supabase
    .from('properties').select('name, address').eq('id', tx.property_id).single()

  const property = propertyRaw as { name: string; address: string | null } | null
  const meta = user.user_metadata as { name?: string; phone?: string; document?: string; address?: string }
  const profile = {
    name:     meta.name     ?? null,
    phone:    meta.phone    ?? null,
    document: meta.document ?? null,
    address:  meta.address  ?? null,
  }

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
      if (raw) tenant = raw as unknown as TenantInfo
    }
  }

  const today = new Date()
  const cidadeData = `${today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`

  return (
    <>
      <style>{`
        @media print {
          aside, nav, .print-hide { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          body { background: white !important; }
          .receipt-box { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      `}</style>

      <div className="print-hide" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <PrintBtn />
        <a href="/dashboard/fluxo" style={{ color: 'var(--text-muted)', fontSize: '14px', textDecoration: 'none' }}>
          ← Voltar ao Fluxo
        </a>
      </div>

      <div className="receipt-box" style={{
        maxWidth: '680px', margin: '0 auto', background: 'white', color: '#1a1a1a',
        borderRadius: '12px', padding: '48px 52px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.15)', fontFamily: 'Georgia, serif',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '20px', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Recibo de Aluguel
          </h1>
          <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>N.º {receiptNumber}</p>
        </div>

        {/* Valor */}
        <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px 24px', marginBottom: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' }}>Valor Recebido</p>
          <p style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 6px', color: '#1a1a1a' }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netAmount)}
          </p>
          <p style={{ fontSize: '13px', color: '#555', margin: 0, fontStyle: 'italic' }}>
            ({valorPorExtenso(netAmount)})
          </p>
        </div>

        {/* Referência + Pagamento */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
          <div>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', margin: '0 0 4px' }}>Referência</p>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{mesAno(tx.billing_month)}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', margin: '0 0 4px' }}>Data de Liquidação</p>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{formatDate(tx.paid_date)}</p>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '0 0 24px' }} />

        {/* Partes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', margin: '0 0 8px' }}>Locador (Recebedor)</p>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>{profile?.name || user.email}</p>
            {profile?.document && <p style={{ fontSize: '13px', color: '#555', margin: '0 0 2px' }}>CPF/CNPJ: {profile.document}</p>}
            {profile?.phone && <p style={{ fontSize: '13px', color: '#555', margin: '0 0 2px' }}>{profile.phone}</p>}
            {profile?.address && <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>{profile.address}</p>}
          </div>
          {tenant && (
            <div>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', margin: '0 0 8px' }}>Locatário (Pagador)</p>
              <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>{tenant.name}</p>
              {tenant.document && <p style={{ fontSize: '13px', color: '#555', margin: '0 0 2px' }}>CPF/CNPJ: {tenant.document}</p>}
              {tenant.email && <p style={{ fontSize: '13px', color: '#555', margin: '0 0 2px' }}>{tenant.email}</p>}
              {tenant.phone && <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>{tenant.phone}</p>}
            </div>
          )}
        </div>

        {/* Imóvel */}
        {property && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', margin: '0 0 8px' }}>Imóvel</p>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>{property.name}</p>
            {property.address && <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>{property.address}</p>}
          </div>
        )}

        {/* Observações */}
        {tx.notes && (
          <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', marginBottom: '24px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', margin: '0 0 4px' }}>Observações</p>
            <p style={{ fontSize: '13px', color: '#444', margin: 0 }}>{tx.notes}</p>
          </div>
        )}

        {/* Ajustes (desconto/acréscimo) */}
        {(Number(tx.discount_amount) > 0 || Number(tx.addition_amount) > 0) && (
          <div style={{ marginBottom: '24px', fontSize: '13px', color: '#555' }}>
            {Number(tx.discount_amount) > 0 && (
              <p style={{ margin: '0 0 4px' }}>
                Valor original: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(tx.amount))}
                {' · '}Desconto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(tx.discount_amount))}
              </p>
            )}
            {Number(tx.addition_amount) > 0 && (
              <p style={{ margin: 0 }}>
                Acréscimo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(tx.addition_amount))}
              </p>
            )}
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '0 0 32px' }} />

        {/* Assinatura */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Assinatura do Locador</p>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '4px 0 0' }}>{profile?.name || '—'}</p>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Local e Data</p>
              <p style={{ fontSize: '13px', color: '#444', margin: '4px 0 0' }}>{cidadeData}</p>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', marginTop: '24px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
          Documento gerado eletronicamente · RentFlow · ID {receiptNumber}
        </p>
      </div>
    </>
  )
}

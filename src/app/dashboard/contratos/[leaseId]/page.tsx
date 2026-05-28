import { notFound } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import PrintBtn from './PrintBtn'
import SendContractEmailBtn from './SendContractEmailBtn'

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

function formatBRL(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

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

type GuaranteeType = 'fiador' | 'caucao' | 'seguro_fianca' | 'titulo_capitalizacao' | 'nenhuma'

function guaranteeLabel(type: GuaranteeType): string {
  switch (type) {
    case 'fiador':               return 'fiança (fiador)'
    case 'caucao':               return 'caução'
    case 'seguro_fianca':        return 'seguro fiança'
    case 'titulo_capitalizacao': return 'título de capitalização'
    default:                     return 'sem garantia'
  }
}

export default async function ContratoPage({ params }: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: lease } = await supabase
    .from('leases')
    .select('id, rent_value, start_date, end_date, due_day, adjustment_index, adjustment_period_months, property_id, tenant_id, landlord_profile_id, guarantee_type, iptu_paid_by, condo_paid_by')
    .eq('id', leaseId)
    .single()

  if (!lease) notFound()

  const [{ data: propertyRaw }, { data: tenantRaw }, { data: landlordProfileRaw }, { data: discountsRaw }] = await Promise.all([
    supabase.from('properties').select('name, address, city, state, type').eq('id', lease.property_id).single(),
    supabase.from('tenants').select('name, document, email, phone, street, street_number, district, city, state, guarantor_name, guarantor_document').eq('id', lease.tenant_id).single(),
    lease.landlord_profile_id
      ? supabase.from('landlord_profiles').select('name, document, phone, address').eq('id', lease.landlord_profile_id).single()
      : supabase.from('landlord_profiles').select('name, document, phone, address').eq('is_default', true).maybeSingle(),
    supabase.from('lease_discounts').select('start_installment, end_installment, discount_value').eq('lease_id', leaseId).order('start_installment', { ascending: true }),
  ])

  const discounts = discountsRaw ?? []

  const property = propertyRaw as { name: string; address: string | null; city: string | null; state: string | null; type: string | null } | null
  const tenant = tenantRaw as { name: string; document: string | null; email: string | null; phone: string | null; street: string | null; street_number: string | null; district: string | null; city: string | null; state: string | null; guarantor_name: string | null; guarantor_document: string | null } | null

  const ownerProfile = landlordProfileRaw as { name: string; document: string | null; phone: string | null; address: string | null } | null
  const owner = {
    name:     ownerProfile?.name     ?? user.email ?? '—',
    phone:    ownerProfile?.phone    ?? null,
    document: ownerProfile?.document ?? null,
    address:  ownerProfile?.address  ?? null,
  }

  const contractNum = leaseId.split('-')[0].toUpperCase()
  const today = new Date()
  const cidadeData = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const propertyAddress = [property?.address, property?.city && property?.state ? `${property.city} - ${property.state}` : (property?.city ?? property?.state)].filter(Boolean).join(', ')

  const tenantAddress = tenant
    ? [tenant.street, tenant.street_number, tenant.district, tenant.city && tenant.state ? `${tenant.city} - ${tenant.state}` : (tenant.city ?? tenant.state)].filter(Boolean).join(', ')
    : null

  const adjustmentClause = lease.adjustment_index
    ? `O aluguel será reajustado a cada ${lease.adjustment_period_months || 12} (${lease.adjustment_period_months || 12} meses) com base na variação do índice ${lease.adjustment_index}, acumulada no período.`
    : 'As partes poderão negociar reajuste ao término de cada período anual.'

  const endClause = lease.end_date
    ? `O prazo de vigência é de ${formatDate(lease.start_date)} a ${formatDate(lease.end_date)}, podendo ser renovado por acordo entre as partes.`
    : `O contrato é por prazo indeterminado, com início em ${formatDate(lease.start_date)}, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.`

  const validGuaranteeTypes: GuaranteeType[] = ['fiador', 'caucao', 'seguro_fianca', 'titulo_capitalizacao', 'nenhuma']
  const guaranteeType: GuaranteeType = validGuaranteeTypes.includes(lease.guarantee_type as GuaranteeType)
    ? (lease.guarantee_type as GuaranteeType)
    : 'nenhuma'

  const isCommercial = property?.type === 'commercial'
  const contractTitle = isCommercial
    ? 'Contrato de Locação Comercial / Não Residencial'
    : 'Contrato de Locação Residencial'

  const iptuText = lease.iptu_paid_by === 'tenant'
    ? 'O IPTU incidente sobre o imóvel será de responsabilidade do LOCATÁRIO.'
    : lease.iptu_paid_by === 'landlord'
    ? 'O IPTU incidente sobre o imóvel será de responsabilidade do LOCADOR.'
    : null

  const condoText = lease.condo_paid_by === 'tenant'
    ? 'As despesas de condomínio serão de responsabilidade do LOCATÁRIO.'
    : lease.condo_paid_by === 'landlord'
    ? 'As despesas de condomínio serão de responsabilidade do LOCADOR.'
    : null

  const hasIptuCondo = !!(iptuText || condoText)

  const sectionStyle = { marginBottom: '28px' }
  const h2Style = { fontSize: '13px', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#888', margin: '0 0 14px', borderBottom: '1px solid #e8e8e8', paddingBottom: '6px' }
  const pStyle = { fontSize: '14px', margin: '0 0 10px' }

  return (
    <>
      <style>{`
        @media print {
          aside, nav, .print-hide { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          body { background: white !important; }
          .contract-box { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      `}</style>

      <div className="print-hide" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <PrintBtn />
        <SendContractEmailBtn leaseId={leaseId} tenantEmail={tenant?.email ?? null} />
        <a href="/dashboard/contratos" style={{ color: 'var(--text-muted)', fontSize: '14px', textDecoration: 'none' }}>
          ← Voltar aos Contratos
        </a>
      </div>

      <div className="contract-box" style={{
        maxWidth: '760px', margin: '0 auto', background: 'white', color: '#1a1a1a',
        borderRadius: '12px', padding: '56px 64px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.15)', fontFamily: 'Georgia, serif', lineHeight: 1.7,
      }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '24px', marginBottom: '36px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            {contractTitle}
          </h1>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>N.º {contractNum} · Referência exclusivamente interna — não possui valor jurídico autônomo</p>
        </div>

        {/* Cláusula 1 — Das Partes */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 1 — Das Partes</h2>
          <p style={pStyle}>
            <strong>LOCADOR:</strong> {owner.name}
            {owner.document ? `, inscrito(a) no CPF/CNPJ sob o n.º ${owner.document}` : ''}
            {owner.phone ? `, telefone ${owner.phone}` : ''}
            {owner.address ? `, residente/domiciliado(a) em ${owner.address}` : ''}.
          </p>
          <p style={{ ...pStyle, margin: guaranteeType === 'fiador' && tenant?.guarantor_name ? '0 0 10px' : 0 }}>
            <strong>LOCATÁRIO:</strong> {tenant?.name ?? '—'}
            {tenant?.document ? `, inscrito(a) no CPF/CNPJ sob o n.º ${tenant.document}` : ''}
            {tenant?.email ? `, e-mail ${tenant.email}` : ''}
            {tenant?.phone ? `, telefone ${tenant.phone}` : ''}
            {tenantAddress ? `, residente/domiciliado(a) em ${tenantAddress}` : ''}.
          </p>
          {guaranteeType === 'fiador' && tenant?.guarantor_name ? (
            <p style={{ fontSize: '14px', margin: 0 }}>
              <strong>FIADOR:</strong> {tenant.guarantor_name}
              {tenant.guarantor_document ? `, inscrito(a) no CPF/CNPJ sob o n.º ${tenant.guarantor_document}` : ''},
              o qual declara possuir bens suficientes para garantir a presente locação, responsabilizando-se
              solidariamente pelas obrigações do LOCATÁRIO.
            </p>
          ) : null}
        </section>

        {/* Cláusula 2 — Do Objeto */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 2 — Do Objeto</h2>
          <p style={{ fontSize: '14px', margin: 0 }}>
            O LOCADOR cede ao LOCATÁRIO, a título de locação, o imóvel denominado <strong>{property?.name ?? '—'}</strong>
            {propertyAddress ? `, localizado em ${propertyAddress}` : ''}, nas condições estabelecidas neste instrumento.
          </p>
        </section>

        {/* Cláusula 3 — Do Prazo */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 3 — Do Prazo</h2>
          <p style={{ fontSize: '14px', margin: 0 }}>{endClause}</p>
        </section>

        {/* Cláusula 4 — Do Aluguel */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 4 — Do Aluguel</h2>
          <p style={pStyle}>
            O aluguel mensal é de <strong>{formatBRL(lease.rent_value)}</strong> ({valorPorExtenso(lease.rent_value)}),
            a ser pago até o dia <strong>{String(lease.due_day).padStart(2, '0')}</strong> de cada mês,
            mediante transferência bancária ou outro meio acordado entre as partes.
          </p>
          {discounts && discounts.length > 0 && (
            <div style={{ margin: '12px 0' }}>
              <p style={{ ...pStyle, fontWeight: 600 }}>
                Parágrafo Único — Fica pactuado um desconto temporário/escalonado no valor do aluguel conforme a seguir:
              </p>
              <ul style={{ fontSize: '14px', margin: '0 0 12px', paddingLeft: '20px', listStyleType: 'disc' }}>
                {discounts.map((d, index) => (
                  <li key={index} style={{ marginBottom: '4px' }}>
                    Desconto de <strong>{formatBRL(d.discount_value)}</strong> e parcelas líquidas de <strong>{formatBRL(lease.rent_value - d.discount_value)}</strong> nas parcelas de {d.start_installment} a {d.end_installment}.
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p style={{ fontSize: '14px', margin: 0 }}>
            O não pagamento no prazo acarretará multa de 2% (dois por cento) sobre o valor em aberto,
            acrescida de juros moratórios de 1% (um por cento) ao mês e correção monetária pelo IGPM.
          </p>
        </section>

        {/* Cláusula 5 — Do Reajuste */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 5 — Do Reajuste</h2>
          <p style={{ fontSize: '14px', margin: 0 }}>{adjustmentClause}</p>
        </section>

        {/* Cláusula 6 — Da Garantia */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 6 — Da Garantia</h2>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Fica estipulado como modalidade de garantia desta locação:{' '}
            <strong>{guaranteeLabel(guaranteeType)}</strong>,
            nos termos do art. 37 da Lei n.º 8.245/1991.
            {guaranteeType === 'nenhuma'
              ? ' As partes declaram expressamente dispensar qualquer modalidade de garantia.'
              : ''}
          </p>
        </section>

        {/* Cláusula 7 — Do IPTU e Condomínio */}
        {hasIptuCondo ? (
          <section style={sectionStyle}>
            <h2 style={h2Style}>Cláusula 7 — Do IPTU e Condomínio</h2>
            {iptuText ? <p style={pStyle}>{iptuText}</p> : null}
            {condoText ? <p style={{ fontSize: '14px', margin: 0 }}>{condoText}</p> : null}
          </section>
        ) : null}

        {/* Cláusula 8 — Das Obrigações */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 8 — Das Obrigações</h2>
          <p style={pStyle}><strong>Do Locatário:</strong></p>
          <ul style={{ fontSize: '14px', margin: '0 0 10px', paddingLeft: '20px' }}>
            <li>Pagar o aluguel na data convencionada;</li>
            <li>Conservar o imóvel em boas condições de uso e higiene;</li>
            <li>Não sublocar, ceder ou emprestar o imóvel sem autorização prévia e por escrito do Locador;</li>
            <li>Responder por danos causados ao imóvel durante o período de locação;</li>
            <li>Devolver o imóvel nas mesmas condições em que o recebeu ao término da locação.</li>
          </ul>
          <p style={pStyle}><strong>Do Locador:</strong></p>
          <ul style={{ fontSize: '14px', margin: 0, paddingLeft: '20px' }}>
            <li>Entregar o imóvel em condições de uso;</li>
            <li>Garantir o uso pacífico do imóvel durante a locação;</li>
            <li>Realizar reparos estruturais que não sejam decorrentes do uso normal pelo Locatário.</li>
          </ul>
        </section>

        {/* Cláusula 9 — Da Rescisão */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Cláusula 9 — Da Rescisão</h2>
          <p style={{ fontSize: '14px', margin: 0 }}>
            A rescisão antecipada por iniciativa do Locatário implicará em multa proporcional ao período remanescente do contrato,
            calculada sobre três meses de aluguel, salvo acordo em contrário. A rescisão por infração contratual dispensa aviso prévio.
          </p>
        </section>

        {/* Cláusula 10 — Do Foro */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={h2Style}>Cláusula 10 — Do Foro</h2>
          <p style={{ fontSize: '14px', margin: 0 }}>
            As partes elegem o foro da Comarca de {property?.city ?? 'domicílio do Locador'} para dirimir quaisquer
            controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
          </p>
        </section>

        {/* Assinaturas */}
        <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
          <p style={{ fontSize: '14px', textAlign: 'center', marginBottom: '48px' }}>
            E por estarem justas e acordadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor.
          </p>
          <p style={{ fontSize: '13px', textAlign: 'center', color: '#555', marginBottom: '48px' }}>{cidadeData}</p>

          {/* Locador / Locatário */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{owner.name}</p>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>LOCADOR</p>
                {owner.document && <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>CPF/CNPJ: {owner.document}</p>}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{tenant?.name ?? '—'}</p>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>LOCATÁRIO</p>
                {tenant?.document && <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>CPF/CNPJ: {tenant.document}</p>}
              </div>
            </div>
          </div>

          {/* Fiador (se aplicável) */}
          {guaranteeType === 'fiador' && tenant?.guarantor_name ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '40px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{tenant.guarantor_name}</p>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>FIADOR</p>
                  {tenant.guarantor_document && <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>CPF/CNPJ: {tenant.guarantor_document}</p>}
                </div>
              </div>
              <div />
            </div>
          ) : null}

          {/* Testemunhas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginTop: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px dashed #aaa', paddingTop: '10px' }}>
                <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>TESTEMUNHA 1 — Nome / CPF</p>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px dashed #aaa', paddingTop: '10px' }}>
                <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>TESTEMUNHA 2 — Nome / CPF</p>
              </div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', marginTop: '24px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
          Documento gerado eletronicamente · RentFlow · Contrato ID {contractNum} · Este documento não substitui assessoria jurídica especializada.
        </p>
      </div>
    </>
  )
}

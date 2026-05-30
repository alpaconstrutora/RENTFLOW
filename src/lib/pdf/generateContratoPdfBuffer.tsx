import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { valorPorExtenso, formatBRL, formatDate } from '../valorPorExtenso'

export type GuaranteeType = 'fiador' | 'caucao' | 'seguro_fianca' | 'titulo_capitalizacao' | 'nenhuma'

export interface ContratoPdfDiscount {
  start_installment: number
  end_installment: number
  discount_value: number
}

export interface ContratoPdfBankAccount {
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
}

export interface ContratoPdfData {
  contractNum: string
  owner: { name: string; document: string | null; phone: string | null; address: string | null }
  tenant: { name: string; document: string | null; email: string | null; phone: string | null } | null
  property: { name: string; city: string | null } | null
  propertyAddress: string
  tenantAddress: string | null
  rentValue: number
  dueDay: number
  startDate: string
  endDate: string | null
  adjustmentIndex: string | null
  adjustmentPeriodMonths: number
  endClause: string
  adjustmentClause: string
  cidadeData: string
  guaranteeType: GuaranteeType
  guarantorName: string | null
  guarantorDocument: string | null
  iptuPaidBy: 'tenant' | 'landlord' | null
  condoPaidBy: 'tenant' | 'landlord' | null
  isCommercial: boolean
  discounts?: ContratoPdfDiscount[]
  bankAccount?: ContratoPdfBankAccount | null
}

const s = StyleSheet.create({
  page:        { padding: 56, fontFamily: 'Helvetica', fontSize: 11, color: '#1a1a1a', lineHeight: 1.6 },
  header:      { borderBottomWidth: 2, borderBottomColor: '#1a1a1a', borderBottomStyle: 'solid', paddingBottom: 20, marginBottom: 32, alignItems: 'center' },
  title:       { fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
  subtitle:    { fontSize: 9, color: '#666' },
  clauseTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 2, color: '#888', borderBottomWidth: 1, borderBottomColor: '#e8e8e8', borderBottomStyle: 'solid', paddingBottom: 4, marginBottom: 10 },
  clause:      { marginBottom: 24 },
  para:        { fontSize: 11, marginBottom: 8 },
  bold:        { fontFamily: 'Helvetica-Bold' },
  listItem:    { fontSize: 11, marginBottom: 4, marginLeft: 12 },
  sigSection:  { borderTopWidth: 1, borderTopColor: '#e0e0e0', borderTopStyle: 'solid', paddingTop: 20, marginTop: 32 },
  sigCenter:   { textAlign: 'center', fontSize: 11, color: '#555', marginBottom: 40 },
  sigRow:      { flexDirection: 'row', marginBottom: 40 },
  sigBox:      { flex: 1, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1a1a1a', borderTopStyle: 'solid', paddingTop: 10 },
  sigBoxRight: { flex: 1, marginLeft: 48, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1a1a1a', borderTopStyle: 'solid', paddingTop: 10 },
  sigName:     { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  sigRole:     { fontSize: 9, color: '#666' },
  sigDoc:      { fontSize: 9, color: '#888', marginTop: 2 },
  witRow:      { flexDirection: 'row' },
  witBox:      { flex: 1, borderTopWidth: 1, borderTopColor: '#aaa', borderTopStyle: 'dashed', paddingTop: 8 },
  witBoxRight: { flex: 1, marginLeft: 48, borderTopWidth: 1, borderTopColor: '#aaa', borderTopStyle: 'dashed', paddingTop: 8 },
  witLabel:    { fontSize: 9, color: '#888', textAlign: 'center' },
  footer:      { fontSize: 8, color: '#bbb', textAlign: 'center', marginTop: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0', borderTopStyle: 'solid', paddingTop: 12 },
})

function guaranteeLabel(type: GuaranteeType): string {
  switch (type) {
    case 'fiador':              return 'fiança (fiador)'
    case 'caucao':              return 'caução'
    case 'seguro_fianca':       return 'seguro fiança'
    case 'titulo_capitalizacao': return 'título de capitalização'
    default:                    return 'sem garantia'
  }
}

export async function generateContratoPdfBuffer(data: ContratoPdfData): Promise<Buffer> {
  const {
    contractNum, owner, tenant, property, propertyAddress, tenantAddress,
    rentValue, dueDay, endClause, adjustmentClause, cidadeData,
    guaranteeType, guarantorName, guarantorDocument,
    iptuPaidBy, condoPaidBy, isCommercial, discounts, bankAccount,
  } = data

  const contractTitle = isCommercial
    ? 'Contrato de Locação Comercial / Não Residencial'
    : 'Contrato de Locação Residencial'

  const iptuText = iptuPaidBy === 'tenant'
    ? 'O IPTU incidente sobre o imóvel será de responsabilidade do LOCATÁRIO.'
    : iptuPaidBy === 'landlord'
    ? 'O IPTU incidente sobre o imóvel será de responsabilidade do LOCADOR.'
    : null

  const condoText = condoPaidBy === 'tenant'
    ? 'As despesas de condomínio serão de responsabilidade do LOCATÁRIO.'
    : condoPaidBy === 'landlord'
    ? 'As despesas de condomínio serão de responsabilidade do LOCADOR.'
    : null

  return renderToBuffer(
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>{contractTitle}</Text>
          <Text style={s.subtitle}>N.º {contractNum} · Referência interna — não possui valor jurídico autônomo</Text>
        </View>

        {/* Cláusula 1 — Das Partes */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 1 — Das Partes</Text>
          <Text style={s.para}>
            <Text style={s.bold}>LOCADOR: </Text>
            {owner.name}
            {owner.document ? `, inscrito(a) no CPF/CNPJ sob o n.º ${owner.document}` : ''}
            {owner.phone ? `, telefone ${owner.phone}` : ''}
            {owner.address ? `, residente/domiciliado(a) em ${owner.address}` : ''}.
          </Text>
          <Text style={s.para}>
            <Text style={s.bold}>LOCATÁRIO: </Text>
            {tenant?.name ?? '—'}
            {tenant?.document ? `, inscrito(a) no CPF/CNPJ sob o n.º ${tenant.document}` : ''}
            {tenant?.email ? `, e-mail ${tenant.email}` : ''}
            {tenant?.phone ? `, telefone ${tenant.phone}` : ''}
            {tenantAddress ? `, residente/domiciliado(a) em ${tenantAddress}` : ''}.
          </Text>
          {guaranteeType === 'fiador' && guarantorName ? (
            <Text style={s.para}>
              <Text style={s.bold}>FIADOR: </Text>
              {guarantorName}
              {guarantorDocument ? `, inscrito(a) no CPF/CNPJ sob o n.º ${guarantorDocument}` : ''}, o qual
              declara possuir bens suficientes para garantir a presente locação, responsabilizando-se solidariamente
              pelas obrigações do LOCATÁRIO.
            </Text>
          ) : null}
        </View>

        {/* Cláusula 2 — Do Objeto */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 2 — Do Objeto</Text>
          <Text style={s.para}>
            O LOCADOR cede ao LOCATÁRIO, a título de locação, o imóvel denominado{' '}
            <Text style={s.bold}>{property?.name ?? '—'}</Text>
            {propertyAddress ? `, localizado em ${propertyAddress}` : ''},
            nas condições estabelecidas neste instrumento.
          </Text>
        </View>

        {/* Cláusula 3 — Do Prazo */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 3 — Do Prazo</Text>
          <Text style={s.para}>{endClause}</Text>
        </View>

        {/* Cláusula 4 — Do Aluguel */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 4 — Do Aluguel</Text>
          <Text style={s.para}>
            O aluguel mensal é de <Text style={s.bold}>{formatBRL(rentValue)}</Text>{' '}
            ({valorPorExtenso(rentValue)}), a ser pago até o dia{' '}
            <Text style={s.bold}>{String(dueDay).padStart(2, '0')}</Text> de cada mês,
            mediante transferência bancária ou outro meio acordado entre as partes.
          </Text>
          {bankAccount ? (
            <View style={{ marginTop: 6, marginBottom: 8, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'solid' }}>
              <Text style={{ ...s.para, fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, color: '#444' }}>
                Dados Bancários para Depósito/Repasse:
              </Text>
              <Text style={{ fontSize: 9, marginBottom: 2 }}>
                <Text style={s.bold}>Favorecido: </Text>{bankAccount.holder_name} (CPF/CNPJ: {bankAccount.holder_document})
              </Text>
              <Text style={{ fontSize: 9, marginBottom: 2 }}>
                <Text style={s.bold}>Banco: </Text>{bankAccount.bank_name} ({bankAccount.bank_code}) · Agência: {bankAccount.branch}{bankAccount.branch_digit ? `-${bankAccount.branch_digit}` : ''} · Conta {bankAccount.account_type === 'checking' ? 'Corrente' : bankAccount.account_type === 'savings' ? 'Poupança' : 'de Pagamento'}: {bankAccount.account}{bankAccount.account_digit ? `-${bankAccount.account_digit}` : ''}
              </Text>
              {bankAccount.pix_key ? (
                <Text style={{ fontSize: 9, marginTop: 2 }}>
                  <Text style={s.bold}>Chave PIX ({bankAccount.pix_key_type?.toUpperCase()}): </Text>{bankAccount.pix_key}
                </Text>
              ) : null}
            </View>
          ) : null}
          {discounts && discounts.length > 0 ? (
            <View style={{ marginTop: 6, marginBottom: 6 }}>
              <Text style={{ ...s.para, fontFamily: 'Helvetica-Bold' }}>
                Parágrafo Único — Fica pactuado um desconto temporário/escalonado no valor do aluguel conforme a seguir:
              </Text>
              {discounts.map((d, idx) => (
                <Text key={idx} style={s.listItem}>
                  • Desconto de {formatBRL(d.discount_value)} e parcelas líquidas de {formatBRL(rentValue - d.discount_value)} nas parcelas de {d.start_installment} a {d.end_installment}.
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={s.para}>
            O não pagamento no prazo acarretará multa de 2% (dois por cento) sobre o valor em aberto,
            acrescida de juros moratórios de 1% (um por cento) ao mês e correção monetária pelo IGPM.
          </Text>
        </View>

        {/* Cláusula 5 — Do Reajuste */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 5 — Do Reajuste</Text>
          <Text style={s.para}>{adjustmentClause}</Text>
        </View>

        {/* Cláusula 6 — Da Garantia */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 6 — Da Garantia</Text>
          <Text style={s.para}>
            Fica estipulado como modalidade de garantia desta locação:{' '}
            <Text style={s.bold}>{guaranteeLabel(guaranteeType)}</Text>,
            nos termos do art. 37 da Lei n.º 8.245/1991.
            {guaranteeType === 'nenhuma'
              ? ' As partes declaram expressamente dispensar qualquer modalidade de garantia.'
              : ''}
          </Text>
        </View>

        {/* Cláusula 7 — Do IPTU e Condomínio */}
        {(iptuText || condoText) ? (
          <View style={s.clause}>
            <Text style={s.clauseTitle}>Cláusula 7 — Do IPTU e Condomínio</Text>
            {iptuText ? <Text style={s.para}>{iptuText}</Text> : null}
            {condoText ? <Text style={s.para}>{condoText}</Text> : null}
          </View>
        ) : null}

        {/* Cláusula 8 — Das Obrigações */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 8 — Das Obrigações</Text>
          <Text style={{ ...s.para, marginBottom: 4 }}><Text style={s.bold}>Do Locatário:</Text></Text>
          <Text style={s.listItem}>• Pagar o aluguel na data convencionada;</Text>
          <Text style={s.listItem}>• Conservar o imóvel em boas condições de uso e higiene;</Text>
          <Text style={s.listItem}>• Não sublocar, ceder ou emprestar o imóvel sem autorização prévia e por escrito do Locador;</Text>
          <Text style={s.listItem}>• Responder por danos causados ao imóvel durante o período de locação;</Text>
          <Text style={{ ...s.listItem, marginBottom: 8 }}>• Devolver o imóvel nas mesmas condições em que o recebeu ao término da locação.</Text>
          <Text style={{ ...s.para, marginBottom: 4 }}><Text style={s.bold}>Do Locador:</Text></Text>
          <Text style={s.listItem}>• Entregar o imóvel em condições de uso;</Text>
          <Text style={s.listItem}>• Garantir o uso pacífico do imóvel durante a locação;</Text>
          <Text style={s.listItem}>• Realizar reparos estruturais que não sejam decorrentes do uso normal pelo Locatário.</Text>
        </View>

        {/* Cláusula 9 — Da Rescisão */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 9 — Da Rescisão</Text>
          <Text style={s.para}>
            A rescisão antecipada por iniciativa do Locatário implicará em multa proporcional ao período remanescente
            do contrato, calculada sobre três meses de aluguel, salvo acordo em contrário.
            A rescisão por infração contratual dispensa aviso prévio.
          </Text>
        </View>

        {/* Cláusula 10 — Do Foro */}
        <View style={s.clause}>
          <Text style={s.clauseTitle}>Cláusula 10 — Do Foro</Text>
          <Text style={s.para}>
            As partes elegem o foro da Comarca de {property?.city ?? 'domicílio do Locador'} para dirimir
            quaisquer controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro,
            por mais privilegiado que seja.
          </Text>
        </View>

        {/* Assinaturas */}
        <View style={s.sigSection}>
          <Text style={s.sigCenter}>
            E por estarem justas e acordadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor.
          </Text>
          <Text style={{ ...s.sigCenter, marginBottom: 48 }}>{cidadeData}</Text>

          {/* Locador / Locatário */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigName}>{owner.name}</Text>
              <Text style={s.sigRole}>LOCADOR</Text>
              {owner.document ? <Text style={s.sigDoc}>CPF/CNPJ: {owner.document}</Text> : null}
            </View>
            <View style={s.sigBoxRight}>
              <Text style={s.sigName}>{tenant?.name ?? '—'}</Text>
              <Text style={s.sigRole}>LOCATÁRIO</Text>
              {tenant?.document ? <Text style={s.sigDoc}>CPF/CNPJ: {tenant.document}</Text> : null}
            </View>
          </View>

          {/* Fiador (se aplicável) */}
          {guaranteeType === 'fiador' && guarantorName ? (
            <View style={{ ...s.sigRow, marginBottom: 40 }}>
              <View style={s.sigBox}>
                <Text style={s.sigName}>{guarantorName}</Text>
                <Text style={s.sigRole}>FIADOR</Text>
                {guarantorDocument ? <Text style={s.sigDoc}>CPF/CNPJ: {guarantorDocument}</Text> : null}
              </View>
              <View style={s.sigBoxRight} />
            </View>
          ) : null}

          {/* Testemunhas */}
          <View style={s.witRow}>
            <View style={s.witBox}>
              <Text style={s.witLabel}>TESTEMUNHA 1 — Nome / CPF</Text>
            </View>
            <View style={s.witBoxRight}>
              <Text style={s.witLabel}>TESTEMUNHA 2 — Nome / CPF</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer}>
          Documento gerado eletronicamente · RentFlow · Contrato ID {contractNum} · Este documento não substitui assessoria jurídica especializada.
        </Text>
      </Page>
    </Document>
  )
}

export function buildContratoPdfData(params: {
  leaseId: string
  lease: {
    rent_value: number
    due_day: number
    start_date: string
    end_date: string | null
    adjustment_index: string | null
    adjustment_period_months: number | null
    guarantee_type: string | null
    iptu_paid_by: string | null
    condo_paid_by: string | null
    code?: number
  }
  property: { name: string; address: string | null; city: string | null; state: string | null; type: string | null } | null
  tenant: {
    name: string
    document: string | null
    email: string | null
    phone: string | null
    street: string | null
    street_number: string | null
    district: string | null
    city: string | null
    state: string | null
    guarantor_name: string | null
    guarantor_document: string | null
  } | null
  owner: { name: string; document: string | null; phone: string | null; address: string | null }
  discounts?: ContratoPdfDiscount[]
  bankAccount?: ContratoPdfBankAccount | null
}): ContratoPdfData {
  const { leaseId, lease, property, tenant, owner, discounts, bankAccount } = params

  const propertyAddress = [
    property?.address,
    property?.city && property?.state ? `${property.city} - ${property.state}` : (property?.city ?? property?.state),
  ].filter(Boolean).join(', ')

  const tenantAddress = tenant
    ? [tenant.street, tenant.street_number, tenant.district, tenant.city && tenant.state ? `${tenant.city} - ${tenant.state}` : (tenant.city ?? tenant.state)].filter(Boolean).join(', ')
    : null

  const adjustPeriod = lease.adjustment_period_months || 12
  const adjustmentClause = lease.adjustment_index
    ? `O aluguel será reajustado a cada ${adjustPeriod} (${adjustPeriod} meses) com base na variação do índice ${lease.adjustment_index}, acumulada no período.`
    : 'As partes poderão negociar reajuste ao término de cada período anual.'

  const endClause = lease.end_date
    ? `O prazo de vigência é de ${formatDate(lease.start_date)} a ${formatDate(lease.end_date)}, podendo ser renovado por acordo entre as partes.`
    : `O contrato é por prazo indeterminado, com início em ${formatDate(lease.start_date)}, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.`

  const cidadeData = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const validGuaranteeTypes: GuaranteeType[] = ['fiador', 'caucao', 'seguro_fianca', 'titulo_capitalizacao', 'nenhuma']
  const guaranteeType: GuaranteeType = validGuaranteeTypes.includes(lease.guarantee_type as GuaranteeType)
    ? (lease.guarantee_type as GuaranteeType)
    : 'nenhuma'

  return {
    contractNum: lease.code ? String(lease.code).padStart(3, '0') : leaseId.split('-')[0].toUpperCase(),
    owner,
    tenant,
    property: property ? { name: property.name, city: property.city } : null,
    propertyAddress,
    tenantAddress: tenantAddress || null,
    rentValue: lease.rent_value,
    dueDay: lease.due_day,
    startDate: lease.start_date,
    endDate: lease.end_date,
    adjustmentIndex: lease.adjustment_index,
    adjustmentPeriodMonths: adjustPeriod,
    endClause,
    adjustmentClause,
    cidadeData,
    guaranteeType,
    guarantorName: tenant?.guarantor_name ?? null,
    guarantorDocument: tenant?.guarantor_document ?? null,
    iptuPaidBy: (lease.iptu_paid_by as 'tenant' | 'landlord' | null) ?? null,
    condoPaidBy: (lease.condo_paid_by as 'tenant' | 'landlord' | null) ?? null,
    isCommercial: property?.type === 'commercial',
    discounts: discounts || [],
    bankAccount: bankAccount || null,
  }
}

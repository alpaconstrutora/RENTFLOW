import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { valorPorExtenso, formatBRL, formatDate, mesAno } from '../valorPorExtenso'

const s = StyleSheet.create({
  page:        { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
  header:      { borderBottomWidth: 2, borderBottomColor: '#1a1a1a', borderBottomStyle: 'solid', paddingBottom: 16, marginBottom: 24, alignItems: 'center' },
  title:       { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  subtitle:    { fontSize: 9, color: '#666' },
  valueBox:    { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 6, padding: 16, marginBottom: 20, alignItems: 'center' },
  valueLabel:  { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  valueAmount: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  valueWords:  { fontSize: 10, color: '#555', fontStyle: 'italic' },
  row:         { flexDirection: 'row', marginBottom: 20 },
  col:         { flex: 1 },
  colRight:    { flex: 1, marginLeft: 16 },
  label:       { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  value:       { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  hr:          { borderBottomWidth: 1, borderBottomColor: '#e0e0e0', borderBottomStyle: 'solid', marginBottom: 20 },
  partyName:   { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  partyDetail: { fontSize: 10, color: '#555', marginBottom: 1 },
  noteBox:     { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 4, padding: 10, marginBottom: 20 },
  sigRow:      { flexDirection: 'row', marginTop: 28 },
  sigBox:      { flex: 1, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1a1a1a', borderTopStyle: 'solid', paddingTop: 8 },
  sigBoxRight: { flex: 1, marginLeft: 48, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1a1a1a', borderTopStyle: 'solid', paddingTop: 8 },
  sigLabel:    { fontSize: 9, color: '#555' },
  sigName:     { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  footer:      { fontSize: 8, color: '#bbb', textAlign: 'center', marginTop: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0', borderTopStyle: 'solid', paddingTop: 12 },
})

export interface ReciboData {
  tx: {
    id: string
    amount: number
    discount_amount: number | null
    addition_amount: number | null
    net_amount: number | null
    paid_date: string | null
    billing_month: string | null
    notes: string | null
  }
  property: { name: string; address: string | null } | null
  tenant: { name: string; document: string | null; email: string | null; phone: string | null } | null
  owner: { name: string; phone: string | null; document: string | null; address: string | null }
  cidadeData: string
}

export function ReciboPDF({ data }: { data: ReciboData }) {
  const { tx, property, tenant, owner, cidadeData } = data
  const netAmount = Number(data.tx.net_amount ?? data.tx.amount)
  const receiptNum = tx.id.split('-')[0].toUpperCase()

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Recibo de Aluguel</Text>
          <Text style={s.subtitle}>N.º {receiptNum}</Text>
        </View>

        <View style={s.valueBox}>
          <Text style={s.valueLabel}>Valor Recebido</Text>
          <Text style={s.valueAmount}>{formatBRL(netAmount)}</Text>
          <Text style={s.valueWords}>({valorPorExtenso(netAmount)})</Text>
        </View>

        <View style={s.row}>
          <View style={s.col}>
            <Text style={s.label}>Referência</Text>
            <Text style={s.value}>{mesAno(tx.billing_month)}</Text>
          </View>
          <View style={s.colRight}>
            <Text style={s.label}>Data de Liquidação</Text>
            <Text style={s.value}>{formatDate(tx.paid_date)}</Text>
          </View>
        </View>

        <View style={s.hr} />

        <View style={s.row}>
          <View style={s.col}>
            <Text style={s.label}>Locador (Recebedor)</Text>
            <Text style={s.partyName}>{owner.name}</Text>
            {owner.document ? <Text style={s.partyDetail}>CPF/CNPJ: {owner.document}</Text> : null}
            {owner.phone    ? <Text style={s.partyDetail}>{owner.phone}</Text> : null}
            {owner.address  ? <Text style={s.partyDetail}>{owner.address}</Text> : null}
          </View>
          {tenant ? (
            <View style={s.colRight}>
              <Text style={s.label}>Locatário (Pagador)</Text>
              <Text style={s.partyName}>{tenant.name}</Text>
              {tenant.document ? <Text style={s.partyDetail}>CPF/CNPJ: {tenant.document}</Text> : null}
              {tenant.email    ? <Text style={s.partyDetail}>{tenant.email}</Text> : null}
              {tenant.phone    ? <Text style={s.partyDetail}>{tenant.phone}</Text> : null}
            </View>
          ) : null}
        </View>

        {property ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={s.label}>Imóvel</Text>
            <Text style={s.partyName}>{property.name}</Text>
            {property.address ? <Text style={s.partyDetail}>{property.address}</Text> : null}
          </View>
        ) : null}

        {tx.notes ? (
          <View style={s.noteBox}>
            <Text style={s.label}>Observações</Text>
            <Text style={{ fontSize: 10, color: '#444', marginTop: 4 }}>{tx.notes}</Text>
          </View>
        ) : null}

        {(Number(tx.discount_amount) > 0 || Number(tx.addition_amount) > 0) ? (
          <View style={{ marginBottom: 20 }}>
            {Number(tx.discount_amount) > 0 ? (
              <Text style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>
                Valor original: {formatBRL(Number(tx.amount))} · Desconto: {formatBRL(Number(tx.discount_amount))}
              </Text>
            ) : null}
            {Number(tx.addition_amount) > 0 ? (
              <Text style={{ fontSize: 10, color: '#555' }}>
                Acréscimo: {formatBRL(Number(tx.addition_amount))}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={s.hr} />

        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Assinatura do Locador</Text>
            <Text style={s.sigName}>{owner.name}</Text>
          </View>
          <View style={s.sigBoxRight}>
            <Text style={s.sigLabel}>Local e Data</Text>
            <Text style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{cidadeData}</Text>
          </View>
        </View>

        <Text style={s.footer}>
          Documento gerado eletronicamente · RentFlow · ID {receiptNum}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateReciboPDF(data: ReciboData): Promise<Buffer> {
  return renderToBuffer(<ReciboPDF data={data} />)
}

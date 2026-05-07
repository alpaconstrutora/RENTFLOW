import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { NextRequest } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { formatBRL } from '../../../../lib/valorPorExtenso'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const s = StyleSheet.create({
  page:        { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
  header:      { borderBottomWidth: 2, borderBottomColor: '#1a1a1a', borderBottomStyle: 'solid', paddingBottom: 14, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title:       { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  subtitle:    { fontSize: 10, color: '#666' },
  kpiRow:      { flexDirection: 'row', marginBottom: 24 },
  kpiBox:      { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 6, padding: 12 },
  kpiBoxMid:   { flex: 1, marginLeft: 12, borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 6, padding: 12 },
  kpiLabel:    { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  kpiValue:    { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 4, padding: '8 10', marginBottom: 4 },
  tableRow:    { flexDirection: 'row', padding: '7 10', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', borderBottomStyle: 'solid' },
  colMes:      { flex: 2, fontSize: 10 },
  colVal:      { flex: 2, fontSize: 10, textAlign: 'right' },
  colValHdr:   { flex: 2, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#555', textTransform: 'uppercase', letterSpacing: 1 },
  colMesHdr:   { flex: 2, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#555', textTransform: 'uppercase', letterSpacing: 1 },
  totalRow:    { flexDirection: 'row', padding: '9 10', borderTopWidth: 2, borderTopColor: '#1a1a1a', borderTopStyle: 'solid', marginTop: 4 },
  footer:      { fontSize: 8, color: '#bbb', textAlign: 'center', marginTop: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0', borderTopStyle: 'solid', paddingTop: 12 },
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autorizado', { status: 401 })

  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
  const today = (todayStr as string | null) ?? new Date().toISOString().split('T')[0]
  const currentYear = parseInt(today.split('-')[0])

  const ano = req.nextUrl.searchParams.get('ano')
  const selectedYear = ano ? parseInt(ano) : currentYear

  const months: string[] = []
  for (let i = 1; i <= 12; i++) {
    months.push(`${selectedYear}-${String(i).padStart(2, '0')}-01`)
  }

  const { data: transactions } = await supabase
    .from('transactions_view')
    .select('type, amount, net_amount, status, billing_month')
    .eq('status', 'paid')
    .gte('billing_month', months[0])
    .lte('billing_month', `${selectedYear}-12-31`)

  const monthData: Record<string, { income: number; expense: number }> = {}
  for (const m of months) monthData[m] = { income: 0, expense: 0 }

  for (const tx of transactions ?? []) {
    const rawBm = tx.billing_month?.split('T')[0] ?? ''
    const bm = rawBm ? `${rawBm.substring(0, 7)}-01` : ''
    if (monthData[bm]) {
      const val = Number(tx.net_amount ?? tx.amount)
      if (tx.type === 'income') monthData[bm].income += val
      else monthData[bm].expense += val
    }
  }

  const entries = months.map((m, i) => ({
    label: MESES[i],
    income: monthData[m].income,
    expense: monthData[m].expense,
    profit: monthData[m].income - monthData[m].expense,
  }))

  const totalIncome  = entries.reduce((s, e) => s + e.income, 0)
  const totalExpense = entries.reduce((s, e) => s + e.expense, 0)
  const totalProfit  = totalIncome - totalExpense

  const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>DRE — {selectedYear}</Text>
            <Text style={s.subtitle}>Demonstrativo de Resultado do Exercício</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#888' }}>Gerado em {geradoEm}</Text>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiLabel}>Receitas Recebidas</Text>
            <Text style={{ ...s.kpiValue, color: '#16a34a' }}>{formatBRL(totalIncome)}</Text>
          </View>
          <View style={s.kpiBoxMid}>
            <Text style={s.kpiLabel}>Despesas / Tributos</Text>
            <Text style={{ ...s.kpiValue, color: '#dc2626' }}>{formatBRL(totalExpense)}</Text>
          </View>
          <View style={s.kpiBoxMid}>
            <Text style={s.kpiLabel}>Lucro Real (DRE)</Text>
            <Text style={{ ...s.kpiValue, color: totalProfit >= 0 ? '#1a1a1a' : '#dc2626' }}>{formatBRL(totalProfit)}</Text>
          </View>
        </View>

        {/* Tabela */}
        <View style={s.tableHeader}>
          <Text style={s.colMesHdr}>Mês</Text>
          <Text style={s.colValHdr}>Receitas</Text>
          <Text style={s.colValHdr}>Despesas</Text>
          <Text style={s.colValHdr}>Resultado</Text>
        </View>

        {entries.map((e, i) => (
          <View key={i} style={{ ...s.tableRow, backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <Text style={s.colMes}>{e.label}</Text>
            <Text style={{ ...s.colVal, color: '#16a34a' }}>{e.income > 0 ? formatBRL(e.income) : '—'}</Text>
            <Text style={{ ...s.colVal, color: '#dc2626' }}>{e.expense > 0 ? formatBRL(e.expense) : '—'}</Text>
            <Text style={{ ...s.colVal, fontFamily: 'Helvetica-Bold', color: e.profit >= 0 ? '#1a1a1a' : '#dc2626' }}>
              {e.income === 0 && e.expense === 0 ? '—' : formatBRL(e.profit)}
            </Text>
          </View>
        ))}

        {/* Totais */}
        <View style={s.totalRow}>
          <Text style={{ ...s.colMes, fontFamily: 'Helvetica-Bold' }}>TOTAL</Text>
          <Text style={{ ...s.colVal, fontFamily: 'Helvetica-Bold', color: '#16a34a' }}>{formatBRL(totalIncome)}</Text>
          <Text style={{ ...s.colVal, fontFamily: 'Helvetica-Bold', color: '#dc2626' }}>{formatBRL(totalExpense)}</Text>
          <Text style={{ ...s.colVal, fontFamily: 'Helvetica-Bold', color: totalProfit >= 0 ? '#1a1a1a' : '#dc2626' }}>{formatBRL(totalProfit)}</Text>
        </View>

        <Text style={s.footer}>
          RentFlow · DRE {selectedYear} · Gerado em {geradoEm} · Somente transações com status "Liquidado" são consideradas.
        </Text>
      </Page>
    </Document>
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dre-${selectedYear}.pdf"`,
    },
  })
}

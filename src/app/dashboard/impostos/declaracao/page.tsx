import { createClientWithUser } from '../../../../utils/supabase/server'
import styles from '../../../page.module.css'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import ReportActions from '../../relatorios/ReportActions'

// Usamos `searchParams` em vez de route param, assim /dashboard/impostos/declaracao?ano=2026
export default async function ImpostosDeclaracaoPage({ searchParams }: { searchParams: Promise<{ ano?: string, year?: string }> }) {
  const resolvedParams = await searchParams
  const { supabase, user } = await createClientWithUser()
  if (!user) redirect('/login')

  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user.id })
  const defaultYear = ((todayStr as string) || new Date().toISOString()).split('-')[0]
  
  const year = resolvedParams.ano || resolvedParams.year || defaultYear
  if (!/^\d{4}$/.test(year)) redirect('/dashboard/impostos')

  const startOfYear = `${year}-01-01`
  // We determine the next year's exact start to slice < endOfYear reliably
  const endOfYear = `${parseInt(year) + 1}-01-01`

  // Buscar perfil
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  const ownerName = profile?.name || 'Sócio(a) Administrador(a) Não Informado'

  // Invariante #13 — leitura via transactions_view, nunca tabela direta
  const { data: transactions } = await supabase
    .from('transactions_view')
    .select('net_amount, lease_id')
    .eq('type', 'income')
    .eq('status', 'paid')
    .gte('billing_month', startOfYear)
    .lt('billing_month', endOfYear)

  // Buscar tenant info via lease_ids únicos
  const leaseIds = [...new Set((transactions || []).map(t => t.lease_id).filter(Boolean))]
  type TenantInfo = { id: string; name: string; document: string | null }
  type LeaseWithTenant = { id: string; tenant: TenantInfo | TenantInfo[] | null }
  const leaseMap: Record<string, TenantInfo> = {}
  if (leaseIds.length > 0) {
    const { data: leasesRaw } = await supabase
      .from('leases')
      .select('id, tenant:tenants(id, name, document)')
      .in('id', leaseIds)
    for (const l of (leasesRaw as LeaseWithTenant[] | null) ?? []) {
      const t = Array.isArray(l.tenant) ? l.tenant[0] : l.tenant
      if (t) leaseMap[l.id] = t
    }
  }

  const tenantAggregations: Record<string, { name: string, document: string, total: number }> = {}
  let totalTributavel = 0

  for (const t of transactions || []) {
    const amount = Number(t.net_amount)
    totalTributavel += amount

    const tenant = t.lease_id ? leaseMap[t.lease_id] : null
    const doc = tenant?.document || 'DOC NÃO INFOR.'
    const name = tenant?.name || 'Desconhecido'
    if (!tenantAggregations[doc]) {
      tenantAggregations[doc] = { name, document: doc, total: 0 }
    }
    tenantAggregations[doc].total += amount
  }

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const tenantList = Object.values(tenantAggregations).sort((a, b) => b.total - a.total)

  return (
    <div className="report-container">
      {/* Esconder durante a impressão */}
      <header className={`${styles.header} print-hidden`}>
        <div>
          <div style={{ marginBottom: '8px' }}>
             <Link href="/dashboard/impostos" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={14} /> Voltar
             </Link>
          </div>
          <h1 className={styles.title}>Demonstrativo de Rendimentos (IRPF)</h1>
          <p className={styles.subtitle}>Cruze inquilinos e rendimentos para enviar ao seu contador na base {year}.</p>
        </div>
        
        <ReportActions selectedYear={parseInt(year)} currentYear={parseInt(defaultYear)} />
      </header>

      {/* Folha A4 de Impressão */}
      <div className="print-area" style={{ background: 'white', color: 'black', padding: '40px', borderRadius: '8px', minHeight: '800px', fontFamily: 'Arial, sans-serif' }}>
         <div style={{ borderBottom: '2px solid black', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
               <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase' }}>Informações de Rendimentos de Locação</h2>
               <p style={{ margin: '0 0 4px', fontSize: '14px' }}><strong>Ano Calendário:</strong> {year} (Anual)</p>
               <p style={{ margin: 0, fontSize: '14px' }}><strong>Proprietário (Locador):</strong> {ownerName}</p>
            </div>
            <div style={{ border: '2px solid black', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', minWidth: '150px' }}>
               DOCUMENTO AUXILIAR<br/><br/>USO CONTÁBIL
            </div>
         </div>

         <div style={{ marginBottom: '30px' }}>
            <p style={{ fontSize: '13px', lineHeight: 1.5, textAlign: 'justify', color: '#333' }}>
               O quadro abaixo explicita os totais de Rendimentos Tributáveis de Locação recebidos e devidamente processados e com status de liquidação durante o ano selecionado, agrupados sob a fonte pagadora (Locatários). Recomendamos conciliar os abatimentos com a contabilidade local.
            </p>
         </div>

         <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '13px', border: '1px solid black' }}>
            <thead>
               <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ padding: '10px', border: '1px solid black', textAlign: 'left', width: '25%' }}>DOCUMENTO (CPF/CNPJ)</th>
                  <th style={{ padding: '10px', border: '1px solid black', textAlign: 'left', width: '50%' }}>FONTE PAGADORA (INQUILINO)</th>
                  <th style={{ padding: '10px', border: '1px solid black', textAlign: 'right', width: '25%' }}>RENDIMENTO BRUTO</th>
               </tr>
            </thead>
            <tbody>
               {tenantList.length === 0 && (
                 <tr>
                   <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#666', border: '1px solid black' }}>
                      Nenhum Rendimento Tributável computado para o período especificado.
                   </td>
                 </tr>
               )}
               {tenantList.map((t, idx) => (
                 <tr key={idx}>
                    <td style={{ padding: '10px', border: '1px solid black', fontFamily: 'monospace' }}>{t.document}</td>
                    <td style={{ padding: '10px', border: '1px solid black' }}>{t.name}</td>
                    <td style={{ padding: '10px', border: '1px solid black', textAlign: 'right', fontWeight: 'bold' }}>{formatBRL(t.total)}</td>
                 </tr>
               ))}
            </tbody>
            <tfoot>
               <tr style={{ background: '#e0e0e0', fontWeight: 'bold' }}>
                  <td colSpan={2} style={{ padding: '12px 10px', border: '1px solid black', textAlign: 'right' }}>TOTAL DE RENDIMENTOS NO ANO {year}</td>
                  <td style={{ padding: '12px 10px', border: '1px solid black', textAlign: 'right' }}>{formatBRL(totalTributavel)}</td>
               </tr>
            </tfoot>
         </table>

         <div style={{ marginTop: '50px', fontSize: '11px', color: '#666', borderTop: '1px dashed #999', paddingTop: '16px' }}>
            <p style={{ margin: '0 0 8px' }}><strong>Atenção:</strong></p>
            <p style={{ margin: '0 0 4px' }}>1) Este relatório não substitui comprovantes formais nem tem valor de certidão legal. Seu objetivo é facilitar e agilizar o input para o contador do titular da carteira ou o preenchimento do Carne-Leão e sistema DIRPF/DIRPJ.</p>
            <p style={{ margin: 0 }}>2) Os valores aqui apresentados estão baseados na data de <strong>Competência (Mês de Faturamento)</strong> da parcela liquidada. Faturas atrasadas liquidadas posteriormente são contabilizadas no ano de sua competência original para facilitar a organização retroativa.</p>
         </div>

      </div>

      {/* Mesmas regras de CSS criadas antes em Global ou injetadas aqui */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; font-family: Arial, Helvetica, sans-serif !important; }
          .print-hidden, #sidebar { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .print-area { padding: 0 !important; box-shadow: none !important; color: black !important; background: white !important; }
        }
      `}} />
    </div>
  )
}

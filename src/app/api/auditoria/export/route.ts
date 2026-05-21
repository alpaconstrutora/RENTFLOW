import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

const TIPO_LABELS: Record<string, string> = {
  payment_marked_paid:   'Pagamento liquidado',
  payment_late:          'Pagamento em atraso',
  payment_reverted:      'Pagamento estornado',
  transaction_adjusted:  'Transação ajustada',
  transaction_cancelled: 'Transação cancelada',
  contract_created:      'Contrato criado',
  contract_renewed:      'Contrato renovado',
  contract_terminated:   'Contrato encerrado',
  lease_created:         'Contrato criado',
  lease_updated:         'Contrato atualizado',
  lease_deleted:         'Contrato excluído',
  backfill_generated:    'Backfill retroativo',
  job_failed:            'Falha de job',
}

const FONTE_LABELS: Record<string, string> = {
  user:    'Usuário',
  system:  'Sistema',
  job:     'Job automático',
  webhook: 'Webhook',
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Não autorizado', { status: 401 })

  const { searchParams } = new URL(request.url)
  const tipo  = searchParams.get('tipo')
  const fonte = searchParams.get('fonte')

  let query = supabase
    .from('domain_events')
    .select('id, event_type, source, payload, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10_000)

  if (tipo)  query = query.eq('event_type', tipo)
  if (fonte) query = query.eq('source', fonte)

  const { data: eventos, error } = await query
  if (error) return new NextResponse('Erro ao buscar eventos', { status: 500 })

  const header = [
    'Data/Hora (BRT)',
    'Evento',
    'Fonte',
    'ID Entidade',
    'Tipo Entidade',
    'Contexto',
  ].map(csvCell).join(',')

  const rows = (eventos ?? []).map(ev => {
    const payload = (ev.payload ?? {}) as Record<string, unknown>
    const ctx     = (payload.context ?? {}) as Record<string, unknown>
    const dt      = new Date(ev.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })

    return [
      dt,
      TIPO_LABELS[ev.event_type] ?? ev.event_type,
      FONTE_LABELS[ev.source ?? ''] ?? (ev.source ?? 'system'),
      String(payload.entity_id ?? ''),
      String(payload.entity_type ?? ''),
      JSON.stringify(ctx),
    ].map(csvCell).join(',')
  })

  // BOM UTF-8 para o Excel abrir corretamente
  const csv = '﻿' + [header, ...rows].join('\r\n')
  const filename = `auditoria-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

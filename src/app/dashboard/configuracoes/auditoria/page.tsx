import { Shield, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import styles from '../../../page.module.css'
import { createClient } from '../../../../utils/supabase/server'

interface SearchParams { tipo?: string; fonte?: string; pagina?: string }

const TIPO_LABELS: Record<string, string> = {
  payment_marked_paid:   'Pagamento liquidado',
  payment_late:          'Pagamento em atraso',
  payment_reverted:      'Pagamento estornado',
  transaction_adjusted:  'Transação ajustada',
  transaction_cancelled: 'Transação cancelada',
  lease_created:         'Contrato criado',
  lease_updated:         'Contrato atualizado',
  lease_deleted:         'Contrato excluído',
  job_failed:            'Falha de job',
}

const FONTE_LABELS: Record<string, string> = {
  user:    'Usuário',
  system:  'Sistema',
  job:     'Job automático',
  webhook: 'Webhook',
}

const FONTE_COLORS: Record<string, string> = {
  user:    'rgba(99,102,241,0.15)',
  system:  'rgba(255,180,0,0.12)',
  job:     'rgba(100,200,100,0.12)',
  webhook: 'rgba(255,100,100,0.12)',
}

const FONTE_TEXT: Record<string, string> = {
  user:    'var(--accent-color)',
  system:  'var(--warning-color)',
  job:     'var(--success-color)',
  webhook: 'var(--danger-color)',
}

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function resumoEvento(eventType: string, payload: Record<string, unknown>): string {
  const ctx = (payload?.context ?? {}) as Record<string, unknown>
  switch (eventType) {
    case 'payment_marked_paid':
      return ctx.amount ? `Valor: R$ ${Number(ctx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
    case 'payment_late':
      return ctx.days_late ? `${ctx.days_late} dia(s) de atraso` : ''
    case 'transaction_adjusted':
      const parts = []
      if (ctx.discount) parts.push(`Desconto: R$ ${Number(ctx.discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      if (ctx.addition) parts.push(`Acréscimo: R$ ${Number(ctx.addition).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      if (ctx.notes) parts.push(`Obs: ${ctx.notes}`)
      return parts.join(' · ')
    case 'job_failed':
      return ctx.error ? String(ctx.error).slice(0, 120) : ''
    default:
      return ''
  }
}

const POR_PAGINA = 50

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const pagina = Math.max(1, parseInt(params.pagina ?? '1'))
  const offset = (pagina - 1) * POR_PAGINA

  let query = supabase
    .from('domain_events')
    .select('id, event_type, event_version, source, payload, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + POR_PAGINA - 1)

  if (params.tipo) query = query.eq('event_type', params.tipo)
  if (params.fonte) query = query.eq('source', params.fonte)

  const { data: eventos, count } = await query

  const totalPaginas = Math.ceil((count ?? 0) / POR_PAGINA)

  const tiposDisponiveis = Object.keys(TIPO_LABELS)
  const fontesDisponiveis = Object.keys(FONTE_LABELS)

  function buildUrl(overrides: Partial<SearchParams>) {
    const p = new URLSearchParams()
    if (params.tipo)   p.set('tipo',   params.tipo)
    if (params.fonte)  p.set('fonte',  params.fonte)
    if (params.pagina) p.set('pagina', params.pagina)
    Object.entries(overrides).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    const qs = p.toString()
    return `/dashboard/configuracoes/auditoria${qs ? `?${qs}` : ''}`
  }

  const filterStyle: React.CSSProperties = {
    padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
    border: '1px solid var(--border-color)', background: 'transparent',
    color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  }
  const filterActiveStyle: React.CSSProperties = {
    ...filterStyle,
    background: 'var(--accent-color)', border: '1px solid var(--accent-color)', color: 'white',
  }

  return (
    <>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/configuracoes" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '14px' }}>
            <ArrowLeft size={14} /> Configurações
          </Link>
          <div>
            <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={20} color="var(--accent-color)" /> Histórico de Auditoria
            </h1>
            <p className={styles.subtitle}>Registro imutável de todas as ações realizadas no sistema.</p>
          </div>
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {count ?? 0} evento{(count ?? 0) !== 1 ? 's' : ''}
        </span>
      </header>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Tipo:</span>
        <Link href={buildUrl({ tipo: undefined, pagina: undefined })} style={!params.tipo ? filterActiveStyle : filterStyle}>
          Todos
        </Link>
        {tiposDisponiveis.map(tipo => (
          <Link key={tipo} href={buildUrl({ tipo, pagina: undefined })} style={params.tipo === tipo ? filterActiveStyle : filterStyle}>
            {TIPO_LABELS[tipo]}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Fonte:</span>
        <Link href={buildUrl({ fonte: undefined, pagina: undefined })} style={!params.fonte ? filterActiveStyle : filterStyle}>
          Todas
        </Link>
        {fontesDisponiveis.map(fonte => (
          <Link key={fonte} href={buildUrl({ fonte, pagina: undefined })} style={params.fonte === fonte ? filterActiveStyle : filterStyle}>
            {FONTE_LABELS[fonte]}
          </Link>
        ))}
      </div>

      {/* Tabela */}
      {!eventos || eventos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <Shield size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <p style={{ margin: 0 }}>Nenhum evento encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data / Hora</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evento</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fonte</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalhe</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((ev, i) => {
                const payload = (ev.payload ?? {}) as Record<string, unknown>
                const entityId = String(payload.entity_id ?? '').split('-')[0].toUpperCase()
                const resumo = resumoEvento(ev.event_type, payload)
                const fonte = ev.source ?? 'system'
                return (
                  <tr key={ev.id} style={{ borderBottom: i < eventos.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.1s' }}>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDateTime(ev.created_at)}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'white', fontWeight: 500 }}>
                      {TIPO_LABELS[ev.event_type] ?? ev.event_type}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                        background: FONTE_COLORS[fonte] ?? 'rgba(255,255,255,0.06)',
                        color: FONTE_TEXT[fonte] ?? 'var(--text-secondary)',
                      }}>
                        {FONTE_LABELS[fonte] ?? fonte}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', maxWidth: '320px' }}>
                      {resumo || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>
                      {entityId || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
          {pagina > 1 && (
            <Link href={buildUrl({ pagina: String(pagina - 1) })} style={filterStyle}>
              ← Anterior
            </Link>
          )}
          <span style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {pagina} / {totalPaginas}
          </span>
          {pagina < totalPaginas && (
            <Link href={buildUrl({ pagina: String(pagina + 1) })} style={filterStyle}>
              Próxima →
            </Link>
          )}
        </div>
      )}
    </>
  )
}

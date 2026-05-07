'use client'

import { useState, useEffect } from 'react'
import { Edit, X, TrendingUp, CalendarClock, FileText, Download } from 'lucide-react'
import { updateLeaseAction, getLeaseDocumentsAction, getLeaseDocumentUrlAction } from './actions'

interface Props {
  lease: {
    id: string
    rent_value: number
    due_day: number
    end_date?: string | null
    billing_start_date?: string | null
    adjustment_period_months?: number | null
    adjustment_index?: string | null
    next_adjustment_date?: string | null
    iptu_paid_by?: string | null
    condo_paid_by?: string | null
    landlord_profile_id?: string | null
  }
  landlordProfiles?: { id: string, name: string, person_type: string, document: string | null, is_default: boolean }[]
}

export default function LeaseEditBtn({ lease, landlordProfiles = [] }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'reajuste' | 'clausula' | 'documentos'>('reajuste')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [newValue, setNewValue] = useState(lease.rent_value)
  const [pct, setPct] = useState('')
  const [docs, setDocs] = useState<{ id: string; version: number; label: string | null; created_at: string; storage_path: string }[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (tab === 'documentos' && isOpen) {
      setDocsLoading(true)
      getLeaseDocumentsAction(lease.id).then(d => { setDocs(d); setDocsLoading(false) })
    }
  }, [tab, isOpen, lease.id])

  async function handleDownload(doc: { id: string; storage_path: string; version: number }) {
    setDownloadingId(doc.id)
    const url = await getLeaseDocumentUrlAction(doc.storage_path)
    setDownloadingId(null)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `contrato-v${doc.version}.pdf`
    a.click()
  }

  function applyPct(p: string) {
    setPct(p)
    const n = parseFloat(p)
    if (!isNaN(n)) setNewValue(parseFloat((lease.rent_value * (1 + n / 100)).toFixed(2)))
  }

  function onNewValueChange(v: number) {
    setNewValue(v)
    if (lease.rent_value > 0) setPct(((v / lease.rent_value - 1) * 100).toFixed(2))
  }

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setErrorMsg('')
    const error = await updateLeaseAction(formData)
    setIsLoading(false)
    if (error) { setErrorMsg(error) } else { setIsOpen(false) }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '14px', borderRadius: '12px', color: 'white', outline: 'none', width: '100%', boxSizing: 'border-box'
  }

  const diff = newValue - lease.rent_value
  const diffPct = lease.rent_value > 0 ? ((diff / lease.rent_value) * 100).toFixed(1) : '0.0'

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
    background: active ? 'var(--accent-color)' : 'transparent',
    color: active ? 'white' : 'var(--text-muted)',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
    transition: '0.2s'
  })

  const formatDate = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{ color: 'var(--accent-color)', fontSize: '14px', fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        <TrendingUp size={14} />
        Reajustar
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'left' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', backgroundColor: 'rgba(25, 28, 38, 0.95)', padding: '40px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>

            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '20px', color: 'white' }}>Editar Contrato</h2>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button type="button" style={tabStyle(tab === 'reajuste')} onClick={() => setTab('reajuste')}>
                <TrendingUp size={12} style={{ marginRight: '4px', display: 'inline' }} />
                Aplicar Reajuste
              </button>
              <button type="button" style={tabStyle(tab === 'clausula')} onClick={() => setTab('clausula')}>
                <CalendarClock size={12} style={{ marginRight: '4px', display: 'inline' }} />
                Cláusula Contratual
              </button>
              <button type="button" style={tabStyle(tab === 'documentos')} onClick={() => setTab('documentos')}>
                <FileText size={12} style={{ marginRight: '4px', display: 'inline' }} />
                Documentos
              </button>
            </div>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <input type="hidden" name="id" value={lease.id} />

              {/* Aba: Reajuste de Valor */}
              {tab === 'reajuste' && (
                <>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '4px' }}>
                    Alteração do valor será registrada em <strong style={{ color: 'white' }}>Histórico de Reajuste</strong> (rent_history) e o próximo reajuste será calculado automaticamente.
                  </p>

                  {/* Calculadora de % */}
                  <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        % de Reajuste <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(IGP-M, IPCA...)</span>
                      </label>
                      <input
                        type="number" step="0.01" placeholder="Ex: 5.47"
                        value={pct}
                        onChange={e => applyPct(e.target.value)}
                        style={{ ...inputStyle, background: 'rgba(0,0,0,0.3)' }}
                      />
                    </div>
                    <div style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: '20px', paddingTop: '18px' }}>→</div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        Valor Atual: {lease.rent_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </label>
                      <input
                        name="rent_value" type="number" step="0.01" required
                        value={newValue}
                        onChange={e => onNewValueChange(parseFloat(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Dia do Vencto. <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input name="due_day" type="number" min="1" max="31" defaultValue={lease.due_day} required style={inputStyle} />
                  </div>

                  {/* I8: Preview do reajuste */}
                  {diff !== 0 && (
                    <div style={{ background: diff > 0 ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${diff > 0 ? 'rgba(0,255,100,0.2)' : 'rgba(255,50,50,0.2)'}`, padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={14} color={diff > 0 ? 'var(--success-color)' : 'var(--danger-color)'} />
                      <span style={{ color: diff > 0 ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '13px', fontWeight: 600 }}>
                        Reajuste: {diff > 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({diff > 0 ? '+' : ''}{diffPct}%)
                      </span>
                    </div>
                  )}

                  {/* I8: Índice de reajuste e notas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Índice Usado</label>
                      <select name="index_used" style={inputStyle}>
                        <option value="">Sem índice</option>
                        <option value="IGPM">IGP-M</option>
                        <option value="IPCA">IPCA</option>
                        <option value="INCC">INCC</option>
                        <option value="LIVRE">Livre acordo</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Motivo / Notas</label>
                      <input name="notes" placeholder="Ex: Reajuste anual IGP-M 2025" style={inputStyle} />
                    </div>
                  </div>
                </>
              )}

              {/* Aba: Cláusula Contratual */}
              {tab === 'clausula' && (
                <>
                  {/* Info do próximo reajuste */}
                  {lease.next_adjustment_date && (
                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CalendarClock size={16} color="var(--accent-color)" />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Próximo reajuste previsto: <strong style={{ color: 'white' }}>{formatDate(lease.next_adjustment_date)}</strong>
                      </span>
                    </div>
                  )}

                  {/* Campo hidden para garantir que rent_value e due_day sejam enviados com valores atuais */}
                  <input type="hidden" name="rent_value" value={lease.rent_value} />
                  <input type="hidden" name="due_day" value={lease.due_day} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Término Vigência</label>
                      <input name="end_date" type="date" defaultValue={lease.end_date?.split('T')[0] ?? ''} style={inputStyle} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Atual: {formatDate(lease.end_date) || 'Indeterminado'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        Início das Parcelas
                      </label>
                      <input name="billing_start_date" type="date" defaultValue={lease.billing_start_date?.split('T')[0] ?? ''} style={{ ...inputStyle, colorScheme: 'dark' }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Alterar cancela parcelas pendentes antes desta data</span>
                    </div>
                  </div>

                  {/* Locador */}
                  {landlordProfiles.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Locador (Perfil)</label>
                      <select name="landlord_profile_id" defaultValue={lease.landlord_profile_id ?? ''} style={inputStyle}>
                        <option value="">Padrão ({landlordProfiles.find(p => p.is_default)?.name ?? '—'})</option>
                        {landlordProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.document ? ` — ${p.document}` : ''} ({p.person_type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Responsabilidade IPTU / Condomínio */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>IPTU — pago por</label>
                      <select name="iptu_paid_by" defaultValue={lease.iptu_paid_by ?? 'tenant'} style={inputStyle}>
                        <option value="tenant">Inquilino</option>
                        <option value="landlord">Proprietário (dedutível no IRPF)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Condomínio — pago por</label>
                      <select name="condo_paid_by" defaultValue={lease.condo_paid_by ?? 'tenant'} style={inputStyle}>
                        <option value="tenant">Inquilino</option>
                        <option value="landlord">Proprietário (dedutível no IRPF)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Periodicidade do Reajuste</label>
                      <select name="adjustment_period_months" defaultValue={lease.adjustment_period_months ?? 12} style={inputStyle}>
                        <option value="6">A cada 6 meses</option>
                        <option value="12">A cada 12 meses</option>
                        <option value="24">A cada 24 meses</option>
                        <option value="36">A cada 36 meses</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Índice Contratual</label>
                      <select name="adjustment_index" defaultValue={lease.adjustment_index ?? 'IGPM'} style={inputStyle}>
                        <option value="IGPM">IGP-M (FGV)</option>
                        <option value="IPCA">IPCA (IBGE)</option>
                        <option value="INCC">INCC</option>
                        <option value="LIVRE">Livre Acordo</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Aba: Documentos */}
              {tab === 'documentos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                    Versões PDF geradas automaticamente ao criar ou reajustar o contrato.
                  </p>
                  {docsLoading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Carregando...</p>
                  ) : docs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                      Nenhum documento gerado ainda.
                    </div>
                  ) : (
                    docs.map(doc => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
                            v{doc.version} — {doc.label ?? 'Snapshot'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {new Date(doc.created_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: downloadingId === doc.id ? 0.6 : 1 }}
                        >
                          <Download size={14} />
                          {downloadingId === doc.id ? 'Gerando...' : 'Baixar PDF'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: '12px', background: 'rgba(255,50,50,0.15)', color: '#ffaaaa', borderRadius: '12px', fontSize: '14px', border: '1px solid rgba(255,50,50,0.3)' }}>
                  {errorMsg}
                </div>
              )}

              {tab !== 'documentos' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={isLoading} style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: isLoading ? 0.7 : 1 }}>
                    {isLoading ? 'Salvando...' : (tab === 'reajuste' ? 'Aplicar Reajuste' : 'Salvar Cláusula')}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}

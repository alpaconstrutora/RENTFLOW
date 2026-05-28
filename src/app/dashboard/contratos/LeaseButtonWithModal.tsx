'use client'

import { useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import styles from '../../page.module.css'
import { createLeaseAction, runBackfillAction } from './actions'

interface Props {
  properties: { id: string, name: string, status: string }[]
  tenants: { id: string, name: string }[]
  landlordProfiles: { id: string, name: string, person_type: string, document: string | null, is_default: boolean }[]
}

export default function LeaseButtonWithModal({ properties, tenants, landlordProfiles }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [backfillInfo, setBackfillInfo] = useState<{ leaseId: string; months: number; startMonth: string } | null>(null)
  const [backfillDone, setBackfillDone] = useState(false)
  const [discounts, setDiscounts] = useState<{ start_installment: number, end_installment: number, discount_value: number }[]>([])

  const addDiscountRow = () => {
    setDiscounts(prev => [...prev, { start_installment: 1, end_installment: 1, discount_value: 0 }])
  }

  const removeDiscountRow = (index: number) => {
    setDiscounts(prev => prev.filter((_, i) => i !== index))
  }

  const updateDiscountRow = (index: number, field: string, value: number) => {
    setDiscounts(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d))
  }

  const vacantProperties = properties.filter(p => p.status === 'vacant')

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setErrorMsg('')
    setBackfillInfo(null)
    setBackfillDone(false)

    const result = await createLeaseAction(formData)
    setIsLoading(false)

    if (typeof result === 'string') {
      setErrorMsg(result)
    } else if (result?.backfill) {
      setBackfillInfo(result.backfill)
    } else {
      setIsOpen(false)
    }
  }

  const handleBackfill = async (confirm: boolean) => {
    if (!backfillInfo) return
    if (!confirm) { setIsOpen(false); return }
    setIsLoading(true)
    const error = await runBackfillAction(backfillInfo.leaseId)
    setIsLoading(false)
    if (error) { setErrorMsg(error); return }
    setBackfillDone(true)
    setTimeout(() => setIsOpen(false), 1500)
  }

  // I9: aviso para due_day > 28
  const [dueDay, setDueDay] = useState(5)

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '14px', borderRadius: '12px', color: 'white', outline: 'none', width: '100%', boxSizing: 'border-box'
  }
  const labelStyle: React.CSSProperties = { fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); setBackfillInfo(null); setBackfillDone(false); setErrorMsg(''); setDiscounts([]) }}
        className={styles.btnPrimary}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none' }}
      >
        <Plus size={16} />
        Aprovar Assinatura de Contrato
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', backgroundColor: 'rgba(25, 28, 38, 0.95)', padding: '32px 24px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.1)', boxSizing: 'border-box', marginBottom: '40px' }}>
            <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>

            {/* I1: Tela de confirmação de backfill retroativo */}
            {backfillInfo && !backfillDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
                <h2 style={{ fontSize: '22px', color: 'white', marginBottom: '12px' }}>Contrato com data retroativa detectado</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7, marginBottom: '24px' }}>
                  Este contrato começou em <strong style={{ color: 'white' }}>{backfillInfo.startMonth}</strong>.<br />
                  Deseja gerar o histórico de <strong style={{ color: 'var(--accent-color)' }}>{backfillInfo.months} mês(es)</strong> retroativo(s)?<br />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>As transações serão criadas como <em>Pendentes</em> — revise e ajuste no Fluxo de Caixa.</span>
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={() => handleBackfill(false)} disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Somente mês atual
                  </button>
                  <button onClick={() => handleBackfill(true)} disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: isLoading ? 0.7 : 1 }}>
                    {isLoading ? 'Gerando histórico...' : `Gerar ${backfillInfo.months} mês(es) retroativo(s)`}
                  </button>
                </div>
                {errorMsg && (
                  <div style={{ padding: '12px', marginTop: '16px', background: 'rgba(255,50,50,0.15)', color: '#ffaaaa', borderRadius: '12px', fontSize: '14px', border: '1px solid rgba(255,50,50,0.3)', textAlign: 'left' }}>
                    {errorMsg}
                  </div>
                )}
              </div>
            ) : backfillDone ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '48px' }}>✅</div>
                <p style={{ color: 'var(--success-color)', fontWeight: 600, marginTop: '12px' }}>Histórico retroativo gerado com sucesso!</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'white' }}>Emissão de Contrato de Locação</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px' }}>Vincule um Imóvel Vago e um Inquilino para ativar o motor transacional.</p>

                <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Imóvel e Inquilino */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Imóvel Alvo (Apenas Vagos) <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                      <select name="property_id" required style={inputStyle}>
                        <option value="">-- Selecione o Imóvel --</option>
                        {vacantProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Inquilino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                      <select name="tenant_id" required style={inputStyle}>
                        <option value="">-- Selecione o Inquilino --</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Valor, Vencimento e Datas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Valor R$ <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                      <input name="rent_value" type="number" step="0.01" required placeholder="5000.00" style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>
                        Dia Vencto. {dueDay > 28 && <span style={{ color: 'var(--warning-color)', fontSize: '11px' }}>⚠ meses curtos</span>}
                      </label>
                      <input
                        name="due_day" type="number" min="1" max="31" required placeholder="05"
                        value={dueDay}
                        onChange={e => setDueDay(parseInt(e.target.value) || 1)}
                        style={{ ...inputStyle, border: `1px solid ${dueDay > 28 ? 'rgba(255,180,0,0.5)' : 'rgba(255,255,255,0.1)'}` }}
                      />
                      {dueDay > 28 && (
                        <span style={{ fontSize: '11px', color: 'var(--warning-color)' }}>
                          Em fev/abr/jun/set/nov o vencimento será ajustado para o último dia.
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Início Vigência <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                      <input name="start_date" type="date" required style={inputStyle} />
                    </div>
                  </div>

                  {/* Término Vigência e Cláusula de Reajuste */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>
                        Início das Parcelas <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(vazio = Início Vigência)</span>
                      </label>
                      <input name="billing_start_date" type="date" style={{ ...inputStyle, colorScheme: 'dark' }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Preencha para conceder carência antes do primeiro pagamento.</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Término Vigência <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(vazio = indeterminado)</span></label>
                      <input name="end_date" type="date" style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Data-base do Reajuste <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(vazio = Início Vigência)</span></label>
                      <input name="adjustment_base_date" type="date" style={inputStyle} />
                    </div>
                  </div>

                  {/* Locador */}
                  {landlordProfiles.length > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Locador (Perfil)</label>
                      <select name="landlord_profile_id" style={inputStyle} defaultValue="">
                        <option value="">Padrão ({landlordProfiles.find(p => p.is_default)?.name ?? '—'})</option>
                        {landlordProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.document ? ` — ${p.document}` : ''} ({p.person_type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Responsabilidade pelo IPTU e Condomínio */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>IPTU — pago por</label>
                      <select name="iptu_paid_by" defaultValue="tenant" style={inputStyle}>
                        <option value="tenant">Inquilino</option>
                        <option value="landlord">Proprietário (dedutível no IRPF)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Condomínio — pago por</label>
                      <select name="condo_paid_by" defaultValue="tenant" style={inputStyle}>
                        <option value="tenant">Inquilino</option>
                        <option value="landlord">Proprietário (dedutível no IRPF)</option>
                      </select>
                    </div>
                  </div>

                  {/* Tipo de Garantia */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Tipo de Garantia</label>
                    <select name="guarantee_type" defaultValue="nenhuma" style={inputStyle}>
                      <option value="nenhuma">Sem garantia</option>
                      <option value="fiador">Fiador</option>
                      <option value="caucao">Caução</option>
                      <option value="seguro_fianca">Seguro Fiança</option>
                      <option value="titulo_capitalizacao">Título de Capitalização</option>
                    </select>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Se "Fiador", os dados são gerenciados no cadastro do inquilino.
                    </span>
                  </div>

                  {/* Cláusula de Reajuste */}
                  <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px', padding: '16px' }}>
                    <p style={{ color: 'var(--accent-color)', fontSize: '12px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Cláusula de Reajuste Anual
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>Periodicidade</label>
                        <select name="adjustment_period_months" style={inputStyle} defaultValue="12">
                          <option value="6">A cada 6 meses</option>
                          <option value="12">A cada 12 meses</option>
                          <option value="24">A cada 24 meses</option>
                          <option value="36">A cada 36 meses</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>Índice Contratual</label>
                        <select name="adjustment_index" style={inputStyle} defaultValue="IGPM">
                          <option value="IGPM">IGP-M (FGV)</option>
                          <option value="IPCA">IPCA (IBGE)</option>
                          <option value="INCC">INCC</option>
                          <option value="LIVRE">Livre Acordo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Descontos Escalonados */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <p style={{ color: 'var(--accent-color)', fontSize: '12px', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Descontos Escalonados / Temporários
                      </p>
                      <button
                        type="button"
                        onClick={addDiscountRow}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-color)', border: '1px solid rgba(99,102,241,0.2)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        <Plus size={12} />
                        Adicionar Faixa
                      </button>
                    </div>

                    {discounts.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0', textAlign: 'center' }}>
                        Nenhum desconto temporário cadastrado para este contrato.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                        {discounts.map((d, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr auto', gap: '10px', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Parcela Inicial</label>
                              <input
                                type="number"
                                min="1"
                                value={d.start_installment}
                                onChange={e => updateDiscountRow(idx, 'start_installment', parseInt(e.target.value) || 1)}
                                style={{ ...inputStyle, padding: '8px 10px', borderRadius: '8px' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Parcela Final</label>
                              <input
                                type="number"
                                min={d.start_installment}
                                value={d.end_installment}
                                onChange={e => updateDiscountRow(idx, 'end_installment', parseInt(e.target.value) || 1)}
                                style={{ ...inputStyle, padding: '8px 10px', borderRadius: '8px' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Valor do Desconto (R$)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={d.discount_value || ''}
                                onChange={e => updateDiscountRow(idx, 'discount_value', parseFloat(e.target.value) || 0)}
                                style={{ ...inputStyle, padding: '8px 10px', borderRadius: '8px' }}
                              />
                            </div>
                            <div style={{ paddingTop: '16px' }}>
                              <button
                                type="button"
                                onClick={() => removeDiscountRow(idx)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <input type="hidden" name="lease_discounts_json" value={JSON.stringify(discounts)} />
                  </div>

                  {errorMsg && (
                    <div style={{ padding: '12px', background: 'rgba(255,50,50,0.15)', color: '#ffaaaa', borderRadius: '12px', fontSize: '14px', border: '1px solid rgba(255,50,50,0.3)' }}>
                      {errorMsg}
                    </div>
                  )}
                  {vacantProperties.length === 0 && (
                    <div style={{ padding: '12px', background: 'rgba(255,200,50,0.1)', color: '#ffd166', borderRadius: '12px', fontSize: '14px', border: '1px solid rgba(255,200,50,0.3)' }}>
                      Nenhum Imóvel Vago disponível. Cadastre um novo em &quot;Imóveis&quot;.
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                    <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={isLoading || vacantProperties.length === 0} style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', background: 'var(--success-bg)', color: 'var(--success-color)', fontWeight: 'bold', cursor: 'pointer', opacity: (isLoading || vacantProperties.length === 0) ? 0.3 : 1 }}>
                      {isLoading ? 'Assinando...' : 'Efetivar Contrato'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

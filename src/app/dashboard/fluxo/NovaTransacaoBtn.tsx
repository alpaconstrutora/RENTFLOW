'use client'

import { useState } from 'react'
import { Plus, X, AlertCircle } from 'lucide-react'
import styles from '../../page.module.css'
import { createTransactionAction } from './actions'

interface Props {
  properties: { id: string; name: string }[]
  leases: { id: string; property_id: string; rent_value: number }[]
}

export default function NovaTransacaoBtn({ properties, leases }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [selectedProperty, setSelectedProperty] = useState('')

  const propertyLeases = leases.filter(l => l.property_id === selectedProperty)

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setErrorMsg('')
    const err = await createTransactionAction(formData)
    setIsLoading(false)
    if (err) { setErrorMsg(err) } else { setIsOpen(false); setSelectedProperty(''); setType('expense') }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '14px', borderRadius: '12px', color: 'white', outline: 'none'
  }

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); setErrorMsg('') }}
        className={styles.btnPrimary}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none' }}
      >
        <Plus size={16} />
        Nova Transação
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', backgroundColor: 'rgba(25,28,38,0.95)', padding: '40px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>

            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '6px', color: 'white' }}>Nova Transação Manual</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Registre uma receita ou despesa avulsa fora do ciclo automático.</p>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Tipo: toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {(['expense', 'income'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setType(t)}
                    style={{
                      padding: '14px', borderRadius: '12px', border: `2px solid ${type === t ? (t === 'income' ? 'var(--success-color)' : 'var(--danger-color)') : 'rgba(255,255,255,0.1)'}`,
                      background: type === t ? (t === 'income' ? 'var(--success-bg)' : 'var(--danger-bg)') : 'transparent',
                      color: type === t ? (t === 'income' ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-secondary)',
                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: '15px'
                    }}
                  >
                    {t === 'income' ? '↑ Receita' : '↓ Despesa'}
                  </button>
                ))}
              </div>
              <input type="hidden" name="type" value={type} />

              {/* Imóvel + Valor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Imóvel <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                  <select name="property_id" required style={inputStyle} value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
                    <option value="">-- Selecione --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Valor R$ <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                  <input name="amount" type="number" step="0.01" required placeholder="0.00" style={inputStyle} />
                </div>
              </div>

              {/* Lease (obrigatório para receita) + Data */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Contrato {type === 'income' && <span style={{ color: 'var(--danger-color)' }}>*</span>}
                    {type === 'income' && <span style={{ fontSize: '11px', color: 'var(--warning-color)', marginLeft: '6px' }}>Obrigatório p/ receita</span>}
                  </label>
                  <select name="lease_id" required={type === 'income'} style={inputStyle}>
                    <option value="">-- Nenhum --</option>
                    {propertyLeases.map(l => (
                      <option key={l.id} value={l.id}>Contrato R${Number(l.rent_value).toFixed(0)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Vencimento <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                  <input name="due_date" type="date" required style={inputStyle} />
                </div>
              </div>

              {/* Notas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Descrição / Notas</label>
                <input name="notes" placeholder="Ex: Manutenção hidráulica, Taxa condominial..." style={inputStyle} />
              </div>

              {type === 'income' && propertyLeases.length === 0 && selectedProperty && (
                <div style={{ display: 'flex', gap: '8px', padding: '12px', background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.3)', borderRadius: '10px' }}>
                  <AlertCircle size={16} color="var(--warning-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '13px', color: 'var(--warning-color)' }}>Este imóvel não possui contratos ativos. Receitas exigem contrato (Invariante #2).</span>
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: '12px', background: 'rgba(255,50,50,0.15)', color: '#ffaaaa', borderRadius: '12px', fontSize: '14px', border: '1px solid rgba(255,50,50,0.3)' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isLoading} style={{ padding: '14px 28px', borderRadius: '12px', background: type === 'income' ? 'var(--success-bg)' : 'var(--danger-bg)', color: type === 'income' ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold', cursor: 'pointer', border: `1px solid ${type === 'income' ? 'rgba(0,255,100,0.3)' : 'rgba(255,50,50,0.3)'}`, opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? 'Registrando...' : `Lançar ${type === 'income' ? 'Receita' : 'Despesa'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

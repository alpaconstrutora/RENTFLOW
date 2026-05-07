'use client'

import { Ban, X } from 'lucide-react'
import { useState } from 'react'
import styles from '../../page.module.css'
import { distratoAction } from './actions'

export default function DistratoBtn({ lease }: { lease: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

  const handleAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorText('')
    
    // Add missing property_id explicitly
    const formData = new FormData(e.currentTarget)
    formData.set('property_id', lease.property_id || lease.property?.id || '')
    
    const error = await distratoAction(formData)
    
    if (error) {
      setErrorText(error)
      setIsLoading(false)
    } else {
      setIsOpen(false)
      setIsLoading(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{ color: 'var(--danger-color)', fontSize: '14px', fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        <Ban size={14} />
        Encerrar / Distrato
      </button>

      {isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'white' }}>Distrato de Contrato</h2>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(255, 10, 10, 0.05)', border: '1px solid rgba(255, 10, 10, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                O distrato encerra permanentemente a vigência ativa deste contrato a partir de hoje. As transações pendentes deverão ser resolvidas manualmente.
              </p>
            </div>

            <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input type="hidden" name="id" value={lease.id} />
              <input type="hidden" name="property_id" value={lease.property_id || lease.property?.id || ''} />
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Valor da Multa Rescisória (BRL)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px' }}>R$</span>
                  <input
                    type="number"
                    step="0.01"
                    name="fine_amount"
                    defaultValue={0}
                    min={0}
                    required
                    style={{ width: '100%', padding: '12px 14px 12px 40px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                  />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', margin: '6px 0 0' }}>
                  Deixe zero se houver isenção ou já estiver pago.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Anotaçoes do Distrato
                </label>
                <input
                  type="text"
                  name="notes"
                  placeholder="Motivo, chave PIX estornada, isenção..."
                  style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                />
              </div>

              {errorText && (
                 <div style={{ color: 'var(--danger-color)', fontSize: '13px', fontWeight: 500, background: 'rgba(255, 60, 60, 0.1)', padding: '10px 14px', borderRadius: '8px' }}>
                    Erro: {errorText}
                 </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                 <button
                   type="button"
                   onClick={() => setIsOpen(false)}
                   className={styles.btnSecondary}
                 >
                   Cancelar
                 </button>
                 <button
                   type="submit"
                   disabled={isLoading}
                   className={styles.btnPrimary}
                   style={{ background: 'var(--danger-color)', color: 'white' }}
                 >
                   {isLoading ? 'Processando...' : 'Confirmar Distrato'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

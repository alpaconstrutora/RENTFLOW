'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useActionState } from 'react'
import { X } from 'lucide-react'
import { createProperty } from './actions'

export default function ClientPropertyModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOpen = searchParams.get('modal') === 'new-property'
  const wrappedAction = (_prev: string | null, formData: FormData) => createProperty(formData)
  const [errorMsg, formAction, isPending] = useActionState(wrappedAction, null)

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 8, 0.75)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
       <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'rgba(25, 28, 38, 0.85)', padding: '40px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>

          <button onClick={() => router.push('/dashboard/imoveis')} style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}>
            <X size={24} />
          </button>

          <h2 style={{ fontSize: '26px', fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'white' }}>Registrar Patrimônio</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px' }}>Insira os dados físicos da sua unidade (Apartamento, Lote ou Edifício Comercial) para habilitar as locações e contratos.</p>

          <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '20px'}}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Identificação/Nome <span style={{color:'var(--danger-color)'}}>*</span></label>
              <input name="name" required placeholder="Ex: Apartamento 402 - Copacabana" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px', borderRadius: '12px', color: 'white', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Classificação de Imóvel</label>
              <select name="type" required style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px', borderRadius: '12px', color: 'white', outline: 'none' }}>
                <option value="residential">Residencial (Apartamento / Casa)</option>
                <option value="commercial">Comercial / Corporativo</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Expectativa de Aluguel Bruto (Mensal)</label>
              <input name="expected_rent" type="number" step="0.01" required placeholder="3500.00" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px', borderRadius: '12px', color: 'white', outline: 'none' }} />
            </div>

            {errorMsg && (
              <div style={{ padding: '12px', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: '12px', fontSize: '14px', border: '1px solid rgba(255,50,50,0.2)' }}>
                Erro ao persistir dado: {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '24px' }}>
              <button type="button" onClick={() => router.push('/dashboard/imoveis')} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}>
                Cancelar
              </button>
              <button type="submit" disabled={isPending} style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 'bold', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1, boxShadow: 'var(--shadow-glow)' }}>
                {isPending ? 'Salvando...' : 'Criar Ativo'}
              </button>
            </div>
          </form>

       </div>
    </div>
  )
}

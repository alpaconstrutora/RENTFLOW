'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { upsertTaxSettings } from './actions'

interface Props {
  initialConfig: {
    ibs_rate: number;
    cbs_rate: number;
  } | null;
}

export default function TaxConfigForm({ initialConfig }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Convertendo decimal para view em Porcentagem
  const ibsDefault = initialConfig ? (initialConfig.ibs_rate * 100).toFixed(2) : "0.65"
  const cbsDefault = initialConfig ? (initialConfig.cbs_rate * 100).toFixed(2) : "0.90"

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setMsg('')
    const error = await upsertTaxSettings(formData)
    setIsLoading(false)
    if (error) {
      setMsg(`Erro: ${error}`)
    } else {
      setMsg("Sucesso! As novas taxas estão blindadas e valerão para as próximas liquidações.")
    }
  }

  return (
    <form action={handleSubmit} className="glass-panel" style={{ padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '600px' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Imposto IBS (%) Base</label>
          <input name="ibs_rate" type="number" step="0.01" defaultValue={ibsDefault} required style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '16px' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Imposto s/ Bens e Serv.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Contrib. CBS (%) Base</label>
          <input name="cbs_rate" type="number" step="0.01" defaultValue={cbsDefault} required style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '16px' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Contrib. s/ Bens e Serv.</span>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '16px', borderRadius: '12px', background: msg.includes('Erro') ? 'var(--danger-bg)' : 'var(--success-bg)', color: msg.includes('Erro') ? 'var(--danger-color)' : 'var(--success-color)', border: `1px solid ${msg.includes('Erro') ? 'rgba(255,50,50,0.3)' : 'rgba(0,255,100,0.3)'}`, marginBottom: '24px', fontSize: '14px', fontWeight: 500 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={isLoading} style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: isLoading ? 0.7 : 1 }}>
          <Save size={18} />
          {isLoading ? 'Registrando na Matriz...' : 'Gravar Parâmetros'}
        </button>
      </div>

    </form>
  )
}

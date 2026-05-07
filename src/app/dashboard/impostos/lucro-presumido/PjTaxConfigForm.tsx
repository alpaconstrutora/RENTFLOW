'use client'

import { useState } from 'react'
import { savePjTaxConfigAction } from './actions'

interface Config {
  pis_rate: number
  cofins_rate: number
  csll_rate: number
  irpj_rate: number
  presumed_base_factor: number
}

const inp: React.CSSProperties = {
  background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)',
  padding: '10px 12px', borderRadius: '10px', color: 'white', outline: 'none',
  width: '100%', boxSizing: 'border-box', fontSize: '14px', textAlign: 'right',
}
const lbl: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }

function pct(v: number) { return (v * 100).toFixed(4).replace(/\.?0+$/, '') }

export default function PjTaxConfigForm({ config }: { config: Config | null }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [err, setErr] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('saving')
    const error = await savePjTaxConfigAction(new FormData(e.currentTarget))
    if (error) { setStatus('error'); setErr(error) } else setStatus('saved')
  }

  const taxes = [
    { key: 'pis_rate',    label: 'PIS',    color: '#f472b6', default: config?.pis_rate    ?? 0.0065 },
    { key: 'cofins_rate', label: 'COFINS', color: '#a78bfa', default: config?.cofins_rate ?? 0.03   },
    { key: 'csll_rate',   label: 'CSLL',   color: '#34d399', default: config?.csll_rate   ?? 0.0288 },
    { key: 'irpj_rate',   label: 'IRPJ',   color: '#fb923c', default: config?.irpj_rate   ?? 0.048  },
  ]

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', maxWidth: '800px' }}>
      <p style={{ fontWeight: 600, color: 'white', marginBottom: '4px' }}>Configuração de Alíquotas (Lucro Presumido)</p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Alíquotas aplicadas sobre a receita bruta de aluguel. Para CSLL e IRPJ, o sistema aplica automaticamente o fator de presunção.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {taxes.map(t => (
            <div key={t.key}>
              <label style={lbl}>
                <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span> — Alíquota %
              </label>
              <input
                name={t.key}
                type="number" step="0.0001" min="0" max="100"
                defaultValue={pct(t.default)}
                style={inp}
              />
            </div>
          ))}
        </div>

        <div style={{ maxWidth: '200px' }}>
          <label style={lbl}>Base de Presunção % <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(CSLL / IRPJ)</span></label>
          <input
            name="presumed_base_factor"
            type="number" step="0.01" min="0" max="100"
            defaultValue={pct(config?.presumed_base_factor ?? 0.32)}
            style={inp}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Padrão 32% para locação de imóveis (Lei 9.249/95)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button type="submit" disabled={status === 'saving'} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'var(--accent-color)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: status === 'saving' ? 0.7 : 1 }}>
            {status === 'saving' ? 'Salvando...' : 'Salvar'}
          </button>
          {status === 'saved' && <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>✓ Salvo</span>}
          {status === 'error' && <span style={{ color: 'var(--danger-color)', fontSize: '13px' }}>{err}</span>}
        </div>
      </form>
    </div>
  )
}

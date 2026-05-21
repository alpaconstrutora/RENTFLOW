'use client'

import { useState } from 'react'
import { ArrowDownToLine, CheckCircle } from 'lucide-react'
import { launchPjTaxesAction } from './actions'

export default function LaunchPjTaxesBtn({ year }: { year: number }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [count, setCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleClick() {
    setState('loading')
    setErrorMsg('')
    const result = await launchPjTaxesAction(year)
    if (typeof result === 'string') {
      setErrorMsg(result)
      setState('error')
    } else {
      setCount(result.count)
      setState('success')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  if (state === 'success') return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: 'var(--success-color)', fontSize: '13px', fontWeight: 600 }}>
      <CheckCircle size={14} />
      {count > 0 ? `${count} lançamento${count !== 1 ? 's' : ''} criado${count !== 1 ? 's' : ''}` : 'Nenhum valor a lançar'}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '10px',
          border: '1px solid rgba(99,102,241,0.35)',
          background: 'rgba(99,102,241,0.08)',
          color: 'var(--accent-color)',
          fontSize: '13px', fontWeight: 600,
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          opacity: state === 'loading' ? 0.6 : 1,
        }}
      >
        <ArrowDownToLine size={14} />
        {state === 'loading' ? 'Lançando...' : 'Lançar no Fluxo de Caixa'}
      </button>
      {state === 'error' && (
        <span style={{ fontSize: '11px', color: 'var(--danger-color)' }}>{errorMsg}</span>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { recalculateMonthIrpf } from './actions'

export default function RecalcBtn({ billingMonth }: { billingMonth: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setMsg('')
    const err = await recalculateMonthIrpf(formData)
    setLoading(false)
    setMsg(err ?? 'Recalculado com sucesso.')
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <input type="hidden" name="billing_month" value={billingMonth} />
      <button
        type="submit"
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
      >
        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        {loading ? 'Recalculando…' : 'Recalcular Mês'}
      </button>
      {msg && (
        <span style={{ fontSize: '13px', color: msg.includes('sucesso') ? '#4ade80' : 'var(--danger-color)' }}>
          {msg}
        </span>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </form>
  )
}

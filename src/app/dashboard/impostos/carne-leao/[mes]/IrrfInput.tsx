'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { updateWithheldIrrf } from './actions'

interface Props {
  transactionId: string
  billingMonth: string
  currentValue: number
}

export default function IrrfInput({ transactionId, billingMonth, currentValue }: Props) {
  const [value, setValue]     = useState(currentValue.toFixed(2))
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setSaved(false)
    const err = await updateWithheldIrrf(formData)
    setLoading(false)
    if (!err) setSaved(true)
  }

  const inp: React.CSSProperties = {
    width: '90px', padding: '6px 10px', borderRadius: '6px',
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', fontSize: '13px', textAlign: 'right',
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input type="hidden" name="transaction_id" value={transactionId} />
      <input type="hidden" name="billing_month"  value={billingMonth} />
      <input
        name="withheld_irrf"
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        style={inp}
      />
      <button
        type="submit"
        disabled={loading}
        title="Salvar IRRF retido"
        style={{ background: saved ? 'rgba(0,200,100,0.15)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: saved ? '#4ade80' : 'var(--text-secondary)', padding: '6px', cursor: 'pointer', display: 'flex' }}
      >
        <Save size={13} />
      </button>
    </form>
  )
}

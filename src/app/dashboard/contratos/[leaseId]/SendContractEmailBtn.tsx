'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import { sendContractEmailAction } from '../actions'

interface Props {
  leaseId: string
  tenantEmail: string | null
}

export default function SendContractEmailBtn({ leaseId, tenantEmail }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleClick() {
    if (!tenantEmail || state === 'loading') return
    setState('loading')
    const result = await sendContractEmailAction(leaseId)
    if ('error' in result) {
      setErrorMsg(result.error)
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    } else {
      setState('sent')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const disabled = !tenantEmail || state === 'loading' || state === 'sent'
  const title = !tenantEmail ? 'Inquilino sem e-mail cadastrado' : undefined

  const label =
    state === 'loading' ? 'Enviando…' :
    state === 'sent'    ? 'Enviado!' :
    state === 'error'   ? errorMsg || 'Erro' :
    'Enviar por E-mail'

  const bg =
    state === 'sent'  ? 'rgba(0,200,100,0.15)' :
    state === 'error' ? 'rgba(255,60,60,0.15)' :
    'rgba(255,255,255,0.08)'

  const color =
    state === 'sent'  ? '#00c864' :
    state === 'error' ? '#ff4444' :
    disabled          ? '#666'    :
    'white'

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
        background: bg, color, fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <Mail size={14} />
      {label}
    </button>
  )
}

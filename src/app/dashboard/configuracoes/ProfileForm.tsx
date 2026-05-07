'use client'

import { useState } from 'react'
import { saveProfileAction } from './actions'

interface Props {
  name: string | null
  phone: string | null
  document: string | null
  address: string | null
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px',
}

export default function ProfileForm({ name, phone, document, address }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('saving')
    setErrMsg('')
    const fd = new FormData(e.currentTarget)
    const err = await saveProfileAction(fd)
    if (err) { setStatus('error'); setErrMsg(err) }
    else setStatus('saved')
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px' }}>
      <div>
        <label style={labelStyle}>Nome completo</label>
        <input name="name" defaultValue={name ?? ''} style={inputStyle} placeholder="Seu nome como locador" />
      </div>
      <div>
        <label style={labelStyle}>CPF / CNPJ</label>
        <input name="document" defaultValue={document ?? ''} style={inputStyle} placeholder="000.000.000-00" />
      </div>
      <div>
        <label style={labelStyle}>Telefone</label>
        <input name="phone" defaultValue={phone ?? ''} style={inputStyle} placeholder="(11) 99999-9999" />
      </div>
      <div>
        <label style={labelStyle}>Endereço (opcional — aparece no recibo)</label>
        <input name="address" defaultValue={address ?? ''} style={inputStyle} placeholder="Rua, número, cidade - UF" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          type="submit"
          disabled={status === 'saving'}
          style={{
            background: 'var(--accent-color)', color: 'white', border: 'none',
            padding: '12px 28px', borderRadius: '10px', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px', opacity: status === 'saving' ? 0.6 : 1,
          }}
        >
          {status === 'saving' ? 'Salvando...' : 'Salvar'}
        </button>
        {status === 'saved' && (
          <span style={{ color: 'var(--success-color)', fontSize: '14px', fontWeight: 600 }}>✓ Salvo com sucesso</span>
        )}
        {status === 'error' && (
          <span style={{ color: 'var(--danger-color)', fontSize: '13px' }}>{errMsg}</span>
        )}
      </div>
    </form>
  )
}

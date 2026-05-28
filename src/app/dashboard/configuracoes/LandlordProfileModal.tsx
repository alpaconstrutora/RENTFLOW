'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { maskDocument, maskPhone } from '../../../lib/masks'
import { upsertLandlordProfileAction } from './landlord-profiles/actions'
import BankAccountTab from '../components/BankAccountTab'

export interface LandlordProfile {
  id: string
  person_type: string
  name: string
  document: string | null
  email: string | null
  phone: string | null
  address: string | null
  is_default: boolean
}

interface Props {
  profile?: LandlordProfile | null
  isOnlyProfile?: boolean
  onClose: () => void
}

const inp: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
  padding: '12px 14px', borderRadius: '10px', color: 'white', outline: 'none',
  width: '100%', boxSizing: 'border-box', fontSize: '14px',
}
const lbl: React.CSSProperties = {
  fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px',
}

export default function LandlordProfileModal({ profile, isOnlyProfile, onClose }: Props) {
  const isEdit = !!profile
  const [activeTab, setActiveTab] = useState<'general' | 'bank'>('general')
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [personType, setPersonType] = useState(profile?.person_type ?? 'pf')
  const [document, setDocument] = useState(profile?.document ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [makeDefault, setMakeDefault] = useState(isOnlyProfile || (profile?.is_default ?? false))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('saving')
    setErrMsg('')
    const fd = new FormData(e.currentTarget)
    const err = await upsertLandlordProfileAction(fd)
    if (err) { setStatus('error'); setErrMsg(err) }
    else { router.refresh(); onClose() }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', backgroundColor: 'rgba(25,28,38,0.97)', padding: '40px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
        <button type="button" onClick={() => { onClose(); setActiveTab('general'); }} style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <X size={24} />
        </button>

        <h2 style={{ fontSize: '22px', color: 'white', marginBottom: '6px' }}>
          {isEdit ? 'Editar Perfil de Locador' : 'Novo Perfil de Locador'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Cada perfil pode ter um CPF ou CNPJ diferente — útil para quem tem imóveis em PF e PJ.
        </p>

        {/* Abas se for Edição */}
        {isEdit && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px', gap: '16px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              style={{
                padding: '10px 4px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${activeTab === 'general' ? 'var(--accent-color)' : 'transparent'}`,
                color: activeTab === 'general' ? 'white' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: '0.2s'
              }}
            >
              👤 Dados Gerais
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              style={{
                padding: '10px 4px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${activeTab === 'bank' ? 'var(--accent-color)' : 'transparent'}`,
                color: activeTab === 'bank' ? 'white' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: '0.2s'
              }}
            >
              💰 Dados Bancários
            </button>
          </div>
        )}

        {!isEdit || activeTab === 'general' ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {isEdit && <input type="hidden" name="id" value={profile!.id} />}
          <input type="hidden" name="is_default" value={makeDefault ? 'true' : 'false'} />

          {/* Tipo de pessoa */}
          <div>
            <label style={lbl}>Tipo de Pessoa</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['pf', 'pj'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setPersonType(t); setDocument('') }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                    background: personType === t ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${personType === t ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: personType === t ? 'var(--accent-color)' : 'var(--text-secondary)',
                  }}
                >
                  {t === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </button>
              ))}
            </div>
            <input type="hidden" name="person_type" value={personType} />
          </div>

          <div>
            <label style={lbl}>Nome completo / Razão Social <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input name="name" required defaultValue={profile?.name ?? ''} style={inp} placeholder={personType === 'pj' ? 'Razão Social Ltda.' : 'Seu nome completo'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={lbl}>{personType === 'pj' ? 'CNPJ' : 'CPF'}</label>
              <input
                name="document"
                value={document}
                onChange={(e) => setDocument(maskDocument(e.target.value, personType as 'pf' | 'pj'))}
                style={inp}
                placeholder={personType === 'pj' ? '00.000.000/0001-00' : '000.000.000-00'}
              />
            </div>
            <div>
              <label style={lbl}>Telefone</label>
              <input
                name="phone"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                style={inp}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label style={lbl}>E-mail</label>
            <input name="email" type="email" defaultValue={profile?.email ?? ''} style={inp} placeholder="voce@email.com" />
          </div>

          <div>
            <label style={lbl}>Endereço (aparece nos documentos)</label>
            <input name="address" defaultValue={profile?.address ?? ''} style={inp} placeholder="Rua, número, cidade - UF" />
          </div>

          {/* Definir como padrão — oculto se já for padrão e não é edição, ou se é único */}
          {!isOnlyProfile && (
            <button
              type="button"
              onClick={() => setMakeDefault(v => !v)}
              disabled={isEdit && profile?.is_default}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', borderRadius: '10px', cursor: (isEdit && profile?.is_default) ? 'default' : 'pointer',
                background: makeDefault ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${makeDefault ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                width: '100%', textAlign: 'left',
              }}
            >
              <div style={{
                width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                background: makeDefault ? 'var(--accent-color)' : 'transparent',
                border: `2px solid ${makeDefault ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {makeDefault && <span style={{ color: 'white', fontSize: '11px', fontWeight: 700 }}>✓</span>}
              </div>
              <div>
                <span style={{ fontSize: '13px', color: makeDefault ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  Definir como perfil padrão
                </span>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  Usado em contratos que não especificam um locador
                </p>
              </div>
            </button>
          )}

          {status === 'error' && (
            <div style={{ padding: '12px', background: 'rgba(255,50,50,0.15)', color: '#ffaaaa', borderRadius: '10px', fontSize: '13px', border: '1px solid rgba(255,50,50,0.3)' }}>
              {errMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={() => { onClose(); setActiveTab('general'); }} style={{ padding: '12px 24px', borderRadius: '10px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={status === 'saving'} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: status === 'saving' ? 0.7 : 1 }}>
              {status === 'saving' ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
        ) : (
          <BankAccountTab ownerType="landlord" ownerId={profile!.id} />
        )}
      </div>
    </div>
  )
}

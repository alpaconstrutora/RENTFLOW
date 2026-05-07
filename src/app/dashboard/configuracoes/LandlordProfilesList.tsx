'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Star, Pencil, Trash2, Building2, User } from 'lucide-react'
import { setDefaultProfileAction, deleteLandlordProfileAction } from './landlord-profiles/actions'
import LandlordProfileModal, { type LandlordProfile } from './LandlordProfileModal'

interface Props {
  profiles: LandlordProfile[]
}

export default function LandlordProfilesList({ profiles }: Props) {
  const router = useRouter()
  const [modalProfile, setModalProfile] = useState<LandlordProfile | null | undefined>(undefined)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState('')

  const openAdd  = () => setModalProfile(null)
  const openEdit = (p: LandlordProfile) => setModalProfile(p)
  const closeModal = () => setModalProfile(undefined)

  async function handleSetDefault(id: string) {
    setLoadingId(id)
    setErrMsg('')
    const err = await setDefaultProfileAction(id)
    setLoadingId(null)
    if (err) setErrMsg(err)
    else router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este perfil de locador?')) return
    setLoadingId(id)
    setErrMsg('')
    const err = await deleteLandlordProfileAction(id)
    setLoadingId(null)
    if (err) setErrMsg(err)
    else router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '700px' }}>
        {(profiles ?? []).map(p => (
          <div
            key={p.id}
            style={{
              background: p.is_default ? 'rgba(99,102,241,0.07)' : 'rgba(0,0,0,0.2)',
              border: `1px solid ${p.is_default ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '14px', padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: '16px',
            }}
          >
            {/* Ícone */}
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: p.is_default ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {p.person_type === 'pj'
                ? <Building2 size={18} color={p.is_default ? 'var(--accent-color)' : 'var(--text-muted)'} />
                : <User size={18} color={p.is_default ? 'var(--accent-color)' : 'var(--text-muted)'} />
              }
            </div>

            {/* Dados */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontWeight: 600, color: 'white', fontSize: '15px' }}>{p.name}</span>
                {p.is_default && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-color)', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    Padrão
                  </span>
                )}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {p.person_type === 'pj' ? 'PJ' : 'PF'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {p.document && <span>{p.document}</span>}
                {p.phone && <span>{p.phone}</span>}
                {p.email && <span>{p.email}</span>}
              </div>
              {p.address && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', opacity: 0.7 }}>{p.address}</div>
              )}
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {!p.is_default && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(p.id)}
                  disabled={loadingId === p.id}
                  title="Definir como padrão"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', opacity: loadingId === p.id ? 0.5 : 1 }}
                >
                  <Star size={13} /> Padrão
                </button>
              )}
              <button
                type="button"
                onClick={() => openEdit(p)}
                title="Editar"
                style={{ display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <Pencil size={14} />
              </button>
              {!p.is_default && (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={loadingId === p.id}
                  title="Excluir"
                  style={{ display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,80,80,0.2)', color: 'var(--danger-color)', cursor: 'pointer', opacity: loadingId === p.id ? 0.5 : 1 }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}

        {errMsg && (
          <div style={{ padding: '12px 16px', background: 'rgba(255,50,50,0.1)', color: '#ffaaaa', borderRadius: '10px', fontSize: '13px', border: '1px solid rgba(255,50,50,0.25)' }}>
            {errMsg}
          </div>
        )}

        <button
          type="button"
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderRadius: '12px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: '0.2s' }}
        >
          <Plus size={16} /> Adicionar Perfil de Locador
        </button>
      </div>

      {modalProfile !== undefined && (
        <LandlordProfileModal
          profile={modalProfile}
          isOnlyProfile={profiles.length === 0}
          onClose={closeModal}
        />
      )}
    </>
  )
}

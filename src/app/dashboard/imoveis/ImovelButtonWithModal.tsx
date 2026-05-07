'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Plus, X, Camera, Search, Loader2 } from 'lucide-react'
import styles from '../../page.module.css'
import { createPropertyAction } from './actions'
import { createClient } from '../../../utils/supabase/client'

const TYPE_OPTIONS = [
  { value: 'apartment',       label: 'Apartamento' },
  { value: 'house',           label: 'Casa' },
  { value: 'studio',          label: 'Kitnet / Studio' },
  { value: 'commercial_room', label: 'Sala Comercial' },
  { value: 'store',           label: 'Loja' },
  { value: 'warehouse',       label: 'Galpão' },
  { value: 'land',            label: 'Terreno / Lote' },
]

interface Props { userId: string }

export default function ImovelButtonWithModal({ userId }: Props) {
  const [isOpen, setIsOpen]         = useState(false)
  const [errorMsg, setErrorMsg]     = useState('')
  const [isLoading, setIsLoading]   = useState(false)

  // Foto
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl]         = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Endereço estruturado
  const [cep, setCep]           = useState('')
  const [street, setStreet]     = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity]         = useState('')
  const [uf, setUf]             = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')

  function reset() {
    setPhotoPreview(null); setPhotoUrl(null); setPhotoLoading(false)
    setCep(''); setStreet(''); setDistrict(''); setCity(''); setUf('')
    setCepLoading(false); setCepError(''); setErrorMsg('')
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setErrorMsg('Foto deve ter no máximo 8 MB.'); return }
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoLoading(true)
    setErrorMsg('')
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('property-photos').upload(path, file)
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(path)
      setPhotoUrl(publicUrl)
    } catch (err) {
      setErrorMsg('Falha no upload: ' + (err as Error).message)
      setPhotoPreview(null)
    } finally {
      setPhotoLoading(false)
    }
  }

  async function handleCepSearch() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) { setCepError('CEP deve ter 8 dígitos.'); return }
    setCepLoading(true); setCepError('')
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) { setCepError('CEP não encontrado.'); return }
      setStreet(data.logradouro || '')
      setDistrict(data.bairro   || '')
      setCity(data.localidade   || '')
      setUf(data.uf             || '')
    } catch {
      setCepError('Erro ao buscar CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    setIsLoading(true); setErrorMsg('')
    const error = await createPropertyAction(formData)
    setIsLoading(false)
    if (error) { setErrorMsg(error) } else { setIsOpen(false); reset() }
  }

  const inp: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '12px 14px', borderRadius: '10px', color: 'white', outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }
  const section: React.CSSProperties = { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-color)', fontWeight: 600, margin: '4px 0 14px', paddingBottom: '8px', borderBottom: '1px solid rgba(99,102,241,0.2)' }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none' }}>
        <Plus size={16} /> Cadastrar Imóvel
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', background: 'rgba(25,28,38,0.97)', padding: '36px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>

            <button onClick={() => { setIsOpen(false); reset() }} disabled={isLoading} style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={22} />
            </button>

            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '4px', color: 'white' }}>Cadastrar Imóvel</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '13px' }}>Preencha os dados para adicionar o imóvel ao seu portfólio.</p>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Foto oculta */}
              <input type="hidden" name="photo_url" value={photoUrl ?? ''} />

              {/* ── FOTO ── */}
              <div>
                <p style={section}>Foto</p>
                <div
                  onClick={() => !photoLoading && fileRef.current?.click()}
                  style={{ cursor: photoLoading ? 'wait' : 'pointer', border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '12px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', position: 'relative' }}
                >
                  {photoPreview ? (
                    <>
                      <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {photoLoading && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader2 size={28} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Camera size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                      <p style={{ fontSize: '13px', margin: 0 }}>Clique para enviar foto</p>
                      <p style={{ fontSize: '11px', margin: '4px 0 0', opacity: 0.6 }}>JPG, PNG ou WEBP — máx. 8 MB</p>
                    </div>
                  )}
                </div>
                {photoPreview && !photoLoading && (
                  <button type="button" onClick={() => { setPhotoPreview(null); setPhotoUrl(null) }} style={{ marginTop: '8px', fontSize: '12px', color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Remover foto
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
              </div>

              {/* ── IDENTIFICAÇÃO ── */}
              <div>
                <p style={section}>Identificação</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={lbl}>Nome <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input name="name" required placeholder="Ex: Apartamento 402 — Copacabana" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Tipo de Imóvel <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <select name="type" required style={{ ...inp, appearance: 'auto' }}>
                      {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── LOCALIZAÇÃO ── */}
              <div>
                <p style={section}>Localização</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* CEP */}
                  <div>
                    <label style={lbl}>CEP</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        name="zip_code" value={cep} placeholder="00000-000"
                        onChange={e => setCep(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCepSearch())}
                        style={{ ...inp, flex: 1 }}
                        maxLength={9}
                      />
                      <button type="button" onClick={handleCepSearch} disabled={cepLoading} style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {cepLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                        Buscar
                      </button>
                    </div>
                    {cepError && <p style={{ fontSize: '12px', color: 'var(--danger-color)', marginTop: '4px' }}>{cepError}</p>}
                  </div>

                  {/* Rua + Número */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                    <div>
                      <label style={lbl}>Rua / Logradouro</label>
                      <input name="street" value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua das Flores" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Número</label>
                      <input name="street_number" placeholder="402" style={{ ...inp, width: '80px' }} />
                    </div>
                  </div>

                  {/* Bairro + Cidade + UF */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: '10px' }}>
                    <div>
                      <label style={lbl}>Bairro</label>
                      <input name="district" value={district} onChange={e => setDistrict(e.target.value)} placeholder="Centro" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Cidade</label>
                      <input name="city" value={city} onChange={e => setCity(e.target.value)} placeholder="São Paulo" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>UF</label>
                      <input name="state" value={uf} onChange={e => setUf(e.target.value)} placeholder="SP" maxLength={2} style={{ ...inp, textTransform: 'uppercase' }} />
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>Complemento</label>
                    <input name="address" placeholder="Bloco B, apto 3" style={inp} />
                  </div>
                </div>
              </div>

              {/* ── FINANCEIRO ── */}
              <div>
                <p style={section}>Financeiro</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={lbl}>Aluguel mensal estimado R$</label>
                    <input name="expected_rent" type="number" step="0.01" placeholder="3.500,00" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Valor de compra R$ <span style={{ color: 'var(--accent-color)', fontSize: '10px' }}>ativa ROI</span></label>
                    <input name="purchase_value" type="number" step="0.01" placeholder="Opcional" style={inp} />
                  </div>
                </div>
              </div>

              {/* ── OBSERVAÇÕES ── */}
              <div>
                <label style={lbl}>Observações</label>
                <textarea name="notes" rows={2} placeholder="Características especiais, reformas previstas..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {errorMsg && (
                <div style={{ padding: '12px', background: 'rgba(255,50,50,0.15)', color: '#ffaaaa', borderRadius: '10px', fontSize: '13px', border: '1px solid rgba(255,50,50,0.3)' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => { setIsOpen(false); reset() }} disabled={isLoading} style={{ padding: '12px 20px', borderRadius: '10px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isLoading || photoLoading} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: (isLoading || photoLoading) ? 0.7 : 1 }}>
                  {isLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}

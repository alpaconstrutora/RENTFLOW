'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Plus, X, Search, Loader2, Camera } from 'lucide-react'
import styles from '../../page.module.css'
import { createTenantAction } from './actions'
import { createClient } from '../../../utils/supabase/client'

const MARITAL_OPTIONS = [
  { value: '',         label: 'Não informado' },
  { value: 'single',   label: 'Solteiro(a)' },
  { value: 'married',  label: 'Casado(a)' },
  { value: 'divorced', label: 'Divorciado(a)' },
  { value: 'widowed',  label: 'Viúvo(a)' },
  { value: 'other',    label: 'Outro' },
]

function maskCpf(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function maskCnpj(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

function validateCpf(v: string): boolean {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0
  if (r !== parseInt(d[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  r = (sum * 10) % 11; if (r === 10 || r === 11) r = 0
  return r === parseInt(d[10])
}

function validateCnpj(v: string): boolean {
  const d = v.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (s: string, w: number[]) => {
    let sum = 0
    for (let i = 0; i < w.length; i++) sum += parseInt(s[i]) * w[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  return calc(d, w1) === parseInt(d[12]) && calc(d, w2) === parseInt(d[13])
}

interface Props { userId: string }

export default function TenantButtonWithModal({ userId }: Props) {
  const [isOpen, setIsOpen]       = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [tenantType, setTenantType] = useState<'individual' | 'company'>('individual')
  const [document, setDocument]   = useState('')
  const [docError, setDocError]   = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [companyName, setCompanyName] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [guarantorDoc, setGuarantorDoc] = useState('')

  // CNPJ lookup
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError]     = useState('')

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl]         = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Address
  const [cep, setCep]           = useState('')
  const [street, setStreet]     = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity]         = useState('')
  const [uf, setUf]             = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError]     = useState('')

  function reset() {
    setTenantType('individual'); setDocument(''); setDocError(''); setPhone(''); setEmail('')
    setCompanyName(''); setStreetNumber(''); setGuarantorDoc('')
    setPhotoPreview(null); setPhotoUrl(null); setPhotoLoading(false)
    setCep(''); setStreet(''); setDistrict(''); setCity(''); setUf('')
    setCepLoading(false); setCepError(''); setCnpjLoading(false); setCnpjError(''); setErrorMsg('')
  }

  async function handleCnpjSearch() {
    const digits = document.replace(/\D/g, '')
    if (digits.length !== 14 || !validateCnpj(document)) { setCnpjError('CNPJ inválido.'); return }
    setCnpjLoading(true); setCnpjError('')
    try {
      const res  = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) { setCnpjError('CNPJ não encontrado.'); return }
      const data = await res.json()
      if (data.razao_social)  setCompanyName(data.razao_social)
      if (data.email)         setEmail(data.email)
      if (data.ddd_telefone_1) setPhone(maskPhone(data.ddd_telefone_1))
      if (data.logradouro)    setStreet(data.logradouro)
      if (data.numero)        setStreetNumber(data.numero)
      if (data.bairro)        setDistrict(data.bairro)
      if (data.municipio)     setCity(data.municipio)
      if (data.uf)            setUf(data.uf)
      if (data.cep)           setCep(data.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2'))
    } catch {
      setCnpjError('Erro ao consultar CNPJ.')
    } finally {
      setCnpjLoading(false)
    }
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setErrorMsg('Foto deve ter no máximo 8 MB.'); return }
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoLoading(true); setErrorMsg('')
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('tenant-photos').upload(path, file)
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage.from('tenant-photos').getPublicUrl(path)
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

  function handleDocumentChange(raw: string) {
    const masked = tenantType === 'company' ? maskCnpj(raw) : maskCpf(raw)
    setDocument(masked)
    setDocError('')
  }

  function validateDocument(): boolean {
    const digits = document.replace(/\D/g, '')
    if (tenantType === 'individual') {
      if (digits.length > 0 && !validateCpf(document)) { setDocError('CPF inválido.'); return false }
    } else {
      if (digits.length > 0 && !validateCnpj(document)) { setDocError('CNPJ inválido.'); return false }
    }
    return true
  }

  async function handleSubmit(formData: FormData) {
    if (!validateDocument()) return
    setIsLoading(true); setErrorMsg('')
    const error = await createTenantAction(formData)
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
      <button
        onClick={() => setIsOpen(true)}
        className={styles.btnPrimary}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none' }}
      >
        <Plus size={16} /> Cadastrar Inquilino
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', background: 'rgba(25,28,38,0.97)', padding: '36px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>

            <button type="button" onClick={() => { setIsOpen(false); reset() }} disabled={isLoading} style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={22} />
            </button>

            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '4px', color: 'white' }}>Novo Inquilino</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '13px' }}>Preencha os dados para adicionar o inquilino à sua carteira.</p>

            <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input type="hidden" name="type"      value={tenantType} />
              <input type="hidden" name="photo_url" value={photoUrl ?? ''} />

              {/* ── TIPO ── */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['individual', 'company'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => { setTenantType(t); setDocument(''); setDocError('') }}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${tenantType === t ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'}`, background: tenantType === t ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.2)', color: tenantType === t ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: tenantType === t ? 600 : 400, fontSize: '13px' }}
                  >
                    {t === 'individual' ? '👤 Pessoa Física' : '🏢 Pessoa Jurídica'}
                  </button>
                ))}
              </div>

              {/* ── FOTO ── */}
              <div>
                <p style={section}>Foto</p>
                <div
                  onClick={() => !photoLoading && fileRef.current?.click()}
                  style={{ cursor: photoLoading ? 'wait' : 'pointer', border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '12px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', position: 'relative' }}
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
                      <Camera size={26} style={{ marginBottom: '8px', opacity: 0.5 }} />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={lbl}>Nome {tenantType === 'company' ? 'da Empresa' : 'Completo'} <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    {tenantType === 'company' ? (
                      <input key="name-company" name="name" required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Razão Social" style={inp} />
                    ) : (
                      <input key="name-individual" name="name" required placeholder="Ex: João da Silva" style={inp} />
                    )}
                  </div>

                  <div>
                    <label style={lbl}>{tenantType === 'company' ? 'CNPJ' : 'CPF'} <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        name="document" required
                        value={document}
                        placeholder={tenantType === 'company' ? '00.000.000/0000-00' : '000.000.000-00'}
                        onChange={e => handleDocumentChange(e.target.value)}
                        onBlur={validateDocument}
                        style={{ ...inp, flex: 1, borderColor: docError ? 'var(--danger-color)' : undefined }}
                      />
                      {tenantType === 'company' && (
                        <button type="button" onClick={handleCnpjSearch} disabled={cnpjLoading} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {cnpjLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                          Buscar
                        </button>
                      )}
                    </div>
                    {docError   && <p style={{ fontSize: '12px', color: 'var(--danger-color)', marginTop: '4px' }}>{docError}</p>}
                    {cnpjError  && <p style={{ fontSize: '12px', color: 'var(--danger-color)', marginTop: '4px' }}>{cnpjError}</p>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={lbl}>E-mail</label>
                      <input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@email.com" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Telefone / WhatsApp</label>
                      <input name="phone" value={phone} placeholder="(11) 99999-9999" onChange={e => setPhone(maskPhone(e.target.value))} style={inp} />
                    </div>
                  </div>

                  {tenantType === 'individual' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={lbl}>RG</label>
                        <input name="rg" placeholder="00.000.000-0" style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Data de Nascimento</label>
                        <input name="birth_date" type="date" style={{ ...inp, colorScheme: 'dark' }} />
                      </div>
                    </div>
                  )}

                  {tenantType === 'individual' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={lbl}>Profissão</label>
                        <input name="profession" placeholder="Engenheiro, Médico..." style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Nacionalidade</label>
                        <input name="nationality" placeholder="Brasileira" style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Estado Civil</label>
                        <select name="marital_status" style={{ ...inp, appearance: 'auto' }}>
                          {MARITAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {tenantType === 'individual' && (
                    <div>
                      <label style={lbl}>Renda Mensal R$</label>
                      <input name="monthly_income" type="number" step="0.01" placeholder="Opcional" style={inp} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── FIADOR ── */}
              {tenantType === 'individual' && (
                <div>
                  <p style={section}>Fiador (opcional)</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={lbl}>Nome do Fiador</label>
                      <input name="guarantor_name" placeholder="Nome completo do fiador" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>CPF do Fiador</label>
                      <input
                        name="guarantor_document"
                        value={guarantorDoc}
                        placeholder="000.000.000-00"
                        onChange={e => setGuarantorDoc(maskCpf(e.target.value))}
                        style={inp}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── ENDEREÇO ── */}
              <div>
                <p style={section}>Endereço</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={lbl}>CEP</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input name="zip_code" value={cep} placeholder="00000-000" onChange={e => setCep(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCepSearch())} style={{ ...inp, flex: 1 }} maxLength={9} />
                      <button type="button" onClick={handleCepSearch} disabled={cepLoading} style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {cepLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                        Buscar
                      </button>
                    </div>
                    {cepError && <p style={{ fontSize: '12px', color: 'var(--danger-color)', marginTop: '4px' }}>{cepError}</p>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                    <div>
                      <label style={lbl}>Rua / Logradouro</label>
                      <input name="street" value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua das Flores" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Número</label>
                      <input name="street_number" value={streetNumber} onChange={e => setStreetNumber(e.target.value)} placeholder="42" style={{ ...inp, width: '80px' }} />
                    </div>
                  </div>

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
                    <input name="address_complement" placeholder="Apto 12, Bloco B" style={inp} />
                  </div>
                </div>
              </div>

              {/* ── OBSERVAÇÕES ── */}
              <div>
                <label style={lbl}>Observações</label>
                <textarea name="notes" rows={2} placeholder="Informações adicionais sobre o inquilino..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
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

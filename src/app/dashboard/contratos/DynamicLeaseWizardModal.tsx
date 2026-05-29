'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, ChevronRight, ChevronLeft, CheckCircle2, Info, Loader2, Zap } from 'lucide-react'
import styles from '../../page.module.css'
import { createLeaseAction, getContractTemplatesAction, getTemplateVariablesAction, getActiveLeaseByPropertyAction, generateContractInstanceAction } from './actions'

interface TenantData {
  id: string
  name: string
  document?: string | null
  rg?: string | null
  email?: string | null
  phone?: string | null
  birth_date?: string | null
  marital_status?: string | null
  profession?: string | null
  nationality?: string | null
  zip_code?: string | null
  street?: string | null
  street_number?: string | null
  district?: string | null
  city?: string | null
  state?: string | null
  address_complement?: string | null
  guarantor_name?: string | null
  guarantor_document?: string | null
}

interface Props {
  properties: { id: string; name: string; status: string; type?: string | null; address?: string | null; zip_code?: string | null; street?: string | null; street_number?: string | null; district?: string | null; city?: string | null; state?: string | null }[]
  tenants: TenantData[]
  landlordProfiles: { id: string; name: string; person_type: string; document: string | null; is_default: boolean; email?: string | null; phone?: string | null; address?: string | null }[]
}

interface Template {
  id: string
  name: string
  category: string
}

interface TemplateVariable {
  id: string
  code: string
  label: string
  field_type: string
  is_required: boolean
  origin: string
  default_value: string | null
  tooltip_help: string | null
}

interface ActiveLeaseData {
  id: string
  rent_value: number
  due_day: number
  start_date: string
  end_date: string | null
  billing_start_date: string | null
  adjustment_index: string | null
  adjustment_period_months: number | null
  landlord_profile_id: string | null
  tenant_id: string
  tenant: { id: string; name: string } | null
}

/** Formata data ISO yyyy-mm-dd para dd/mm/yyyy */
function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

/** Monta endereço completo do inquilino */
function buildTenantAddress(t: TenantData): string {
  const parts: string[] = []
  if (t.street) {
    const streetFull = t.street_number ? `${t.street}, ${t.street_number}` : t.street
    parts.push(streetFull)
  }
  if (t.district) parts.push(t.district)
  if (t.city && t.state) parts.push(`${t.city} - ${t.state}`)
  else if (t.city) parts.push(t.city)
  if (t.zip_code) parts.push(`CEP ${t.zip_code}`)
  return parts.join(', ')
}

/** Traduz marital_status para português */
function fmtMaritalStatus(s: string | null | undefined): string {
  const map: Record<string, string> = {
    single: 'Solteiro(a)', married: 'Casado(a)', divorced: 'Divorciado(a)',
    widowed: 'Viúvo(a)', other: 'Outro'
  }
  return s ? (map[s] || s) : ''
}

/** Traduz tipo do imóvel para português */
function fmtPropertyType(t: string | null | undefined): string {
  const map: Record<string, string> = {
    residential: 'Residencial', commercial: 'Comercial',
    apartment: 'Apartamento', house: 'Casa', studio: 'Studio/Kitnet',
    commercial_room: 'Sala Comercial', store: 'Loja', warehouse: 'Galpão/Depósito', land: 'Terreno'
  }
  return t ? (map[t] || t) : ''
}

export default function DynamicLeaseWizardModal({ properties, tenants, landlordProfiles }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [templates, setTemplates] = useState<Template[]>([])
  const [detectedVariables, setDetectedVariables] = useState<TemplateVariable[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingLease, setIsLoadingLease] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Contrato ativo carregado automaticamente
  const [loadedFromLease, setLoadedFromLease] = useState<ActiveLeaseData | null>(null)

  // Step 1: Base selections
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [rentValue, setRentValue] = useState('')
  const [dueDay, setDueDay] = useState(5)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [billingStartDate, setBillingStartDate] = useState('')

  // Step 2: Dynamic fields values
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({})

  // ─── Carregar templates ao abrir ───────────────────────────────────────────
  useEffect(() => {
    if (isOpen) loadTemplates()
  }, [isOpen])

  const loadTemplates = async () => {
    const data = await getContractTemplatesAction()
    setTemplates(data as Template[])
  }

  // ─── Auto-preenchimento ao selecionar imóvel ──────────────────────────────
  const handlePropertyChange = useCallback(async (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setLoadedFromLease(null)

    if (!propertyId) return

    const property = properties.find(p => p.id === propertyId)
    if (!property || property.status === 'vacant') return

    setIsLoadingLease(true)
    try {
      const lease = await getActiveLeaseByPropertyAction(propertyId) as ActiveLeaseData | null
      if (lease) {
        setLoadedFromLease(lease)
        setRentValue(String(lease.rent_value))
        setDueDay(lease.due_day)
        setStartDate(lease.start_date)
        setEndDate(lease.end_date ?? '')
        setBillingStartDate(lease.billing_start_date ?? '')
        setSelectedTenantId(lease.tenant_id)
        if (lease.landlord_profile_id) setSelectedProfileId(lease.landlord_profile_id)
      }
    } finally {
      setIsLoadingLease(false)
    }
  }, [properties])

  // ─── Carregar variáveis ao selecionar template ────────────────────────────
  useEffect(() => {
    if (selectedTemplateId) {
      loadVariables(selectedTemplateId)
    } else {
      setDetectedVariables([])
    }
  }, [selectedTemplateId])

  const loadVariables = async (templateId: string) => {
    setIsLoading(true)
    const vars = await getTemplateVariablesAction(templateId)
    setDetectedVariables(vars as TemplateVariable[])
    setIsLoading(false)
  }

  // ─── Resolução de variáveis — mapa completo de origens ───────────────────
  useEffect(() => {
    if (!selectedTenantId && !selectedPropertyId) return

    const tenant = tenants.find(t => t.id === selectedTenantId)
    const property = properties.find(p => p.id === selectedPropertyId)
    const profile = landlordProfiles.find(p => p.id === selectedProfileId) || landlordProfiles.find(p => p.is_default)

    const resolved: Record<string, string> = {}

    detectedVariables.forEach(v => {
      let val = ''
      switch (v.origin) {
        // ── Inquilino ──
        case 'db_tenant_name':        val = tenant?.name || ''; break
        case 'db_tenant_document':    val = tenant?.document || ''; break
        case 'db_tenant_rg':          val = tenant?.rg || ''; break
        case 'db_tenant_email':       val = tenant?.email || ''; break
        case 'db_tenant_phone':       val = tenant?.phone || ''; break
        case 'db_tenant_birth_date':  val = fmtDate(tenant?.birth_date); break
        case 'db_tenant_profession':  val = tenant?.profession || ''; break
        case 'db_tenant_nationality': val = tenant?.nationality || ''; break
        case 'db_tenant_marital_status': val = fmtMaritalStatus(tenant?.marital_status); break
        case 'db_tenant_address':     val = tenant ? buildTenantAddress(tenant) : ''; break
        case 'db_tenant_zip_code':    val = tenant?.zip_code || ''; break
        // ── Fiador ──
        case 'db_guarantor_name':     val = tenant?.guarantor_name || ''; break
        case 'db_guarantor_document': val = tenant?.guarantor_document || ''; break
        // ── Locador ──
        case 'db_landlord_name':      val = profile?.name || ''; break
        case 'db_landlord_document':  val = profile?.document || ''; break
        case 'db_landlord_email':     val = profile?.email || ''; break
        case 'db_landlord_phone':     val = profile?.phone || ''; break
        case 'db_landlord_address':   val = profile?.address || ''; break
        // ── Imóvel ──
        case 'db_property_name':    val = property?.name || ''; break
        case 'db_property_type':    val = fmtPropertyType(property?.type); break
        case 'db_property_zip_code': val = property?.zip_code || ''; break
        case 'db_property_city':    val = property?.city || ''; break
        case 'db_property_state':   val = property?.state || ''; break
        case 'db_property_street':
          val = property?.street
            ? (property.street_number ? `${property.street}, ${property.street_number}` : property.street)
            : ''
          break
        case 'db_property_district': val = property?.district || ''; break
        case 'db_property_address':
          val = [
            property?.street && property?.street_number
              ? `${property.street}, ${property.street_number}`
              : property?.street || property?.address,
            property?.district,
            property?.city && property?.state ? `${property.city} - ${property.state}` : (property?.city ?? property?.state),
            property?.zip_code ? `CEP ${property.zip_code}` : null
          ].filter(Boolean).join(', ')
          break
        // ── Contrato ──
        case 'db_rent_value':
          val = rentValue ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(rentValue)) : ''
          break
        case 'db_due_day':   val = dueDay ? String(dueDay).padStart(2, '0') : ''; break
        case 'db_start_date': val = startDate ? fmtDate(startDate) : ''; break
        case 'db_end_date':   val = endDate ? fmtDate(endDate) : 'Indeterminado'; break
        default:
          val = dynamicValues[v.code] || v.default_value || ''
      }
      resolved[v.code] = val
    })

    setDynamicValues(prev => ({ ...prev, ...resolved }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId, selectedPropertyId, selectedProfileId, rentValue, dueDay, startDate, endDate, detectedVariables])

  // ─── Navegação entre steps ────────────────────────────────────────────────
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedPropertyId || !selectedTenantId || !rentValue || !startDate) {
        setErrorMsg('Preencha os campos obrigatórios (*).')
        return
      }
    }
    setErrorMsg('')
    setCurrentStep(prev => prev + 1)
  }

  const handlePrevStep = () => {
    setErrorMsg('')
    setCurrentStep(prev => prev - 1)
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    const missing = detectedVariables.filter(v => v.is_required && !dynamicValues[v.code])
    if (missing.length > 0) {
      setErrorMsg(`Campos obrigatórios sem preenchimento: ${missing.map(m => m.label || m.code).join(', ')}`)
      setIsLoading(false)
      return
    }

    try {
      if (loadedFromLease) {
        const result = await generateContractInstanceAction(selectedTemplateId, loadedFromLease.id, dynamicValues)
        if (!result.success) {
          setErrorMsg(result.error || 'Erro ao gerar documento.')
          setIsLoading(false)
          return
        }
      } else {
        const formData = new FormData()
        formData.append('property_id', selectedPropertyId)
        formData.append('tenant_id', selectedTenantId)
        formData.append('rent_value', rentValue)
        formData.append('due_day', String(dueDay))
        formData.append('start_date', startDate)
        formData.append('end_date', endDate)
        formData.append('billing_start_date', billingStartDate)
        formData.append('landlord_profile_id', selectedProfileId)
        formData.append('lease_discounts_json', '[]')

        const result = await createLeaseAction(formData)
        if (typeof result === 'string') {
          setErrorMsg(result)
          setIsLoading(false)
          return
        }

        // Suporta tanto o retorno de contrato normal quanto retroativo (objeto backfill)
        const leaseIdToUse = result?.leaseId || (result as any)?.backfill?.leaseId

        if (selectedTemplateId && leaseIdToUse) {
          const genResult = await generateContractInstanceAction(selectedTemplateId, leaseIdToUse, dynamicValues)
          if (!genResult.success) {
            setErrorMsg(genResult.error || 'Erro ao gerar documento do modelo.')
            setIsLoading(false)
            return
          }
        }
      }

      setSuccessMsg('Documento gerado com sucesso!')
      setTimeout(() => { setIsOpen(false); resetForm() }, 1500)

    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Erro ao efetivar contrato.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setCurrentStep(1); setSelectedPropertyId(''); setSelectedTenantId('')
    setSelectedTemplateId(''); setSelectedProfileId(''); setRentValue('')
    setDueDay(5); setStartDate(''); setEndDate(''); setBillingStartDate('')
    setSuccessMsg(''); setErrorMsg(''); setLoadedFromLease(null); setDynamicValues({})
  }

  // ─── Styles ───────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
    padding: '14px', borderRadius: '12px', color: 'white', outline: 'none', width: '100%', boxSizing: 'border-box'
  }
  const inputReadonlyStyle: React.CSSProperties = {
    ...inputStyle, background: 'rgba(99,102,241,0.06)',
    border: '1px solid rgba(99,102,241,0.25)', color: 'rgba(255,255,255,0.7)', cursor: 'default'
  }
  const labelStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 500 }
  const isOccupied = !!loadedFromLease

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); resetForm() }}
        className={styles.btnPrimary}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none' }}
      >
        <Plus size={16} />
        Emissão Parametrizada
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', backgroundColor: 'rgba(25, 28, 38, 0.95)', padding: '32px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box', marginBottom: '40px' }}>

            <button type="button" onClick={() => { setIsOpen(false); resetForm() }} disabled={isLoading} style={{ position: 'absolute', top: '28px', right: '28px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>

            {/* Steps */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                {[{ n: 1, label: 'Vínculos' }, { n: 2, label: 'Formulário' }, { n: 3, label: 'Efetivar' }].map(({ n, label }) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '28px', height: '28px', background: currentStep >= n ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>{n}</span>
                    <span style={{ fontSize: '13px', fontWeight: currentStep === n ? 600 : 400, color: currentStep === n ? 'white' : 'var(--text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Passo {currentStep} de 3</span>
            </div>

            {errorMsg && <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: '12px', fontSize: '13px', border: '1px solid rgba(255,74,107,0.2)', marginBottom: '20px' }}>{errorMsg}</div>}
            {successMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: '12px', fontSize: '13px', border: '1px solid rgba(0,229,155,0.2)', marginBottom: '20px' }}>
                <CheckCircle2 size={16} />{successMsg}
              </div>
            )}

            {/* ── STEP 1 ─────────────────────────────────────────────── */}
            {currentStep === 1 && (
              <div>
                <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '4px', fontWeight: 600 }}>Parâmetros do Contrato</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                  Selecione o imóvel. Se já houver contrato ativo, os dados são carregados automaticamente.
                </p>

                {isLoadingLease && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-color)', borderRadius: '12px', fontSize: '13px', border: '1px solid rgba(99,102,241,0.2)', marginBottom: '20px' }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Buscando contrato ativo do imóvel...
                  </div>
                )}
                {loadedFromLease && !isLoadingLease && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(0,229,155,0.06)', color: 'var(--success-color)', borderRadius: '12px', fontSize: '13px', border: '1px solid rgba(0,229,155,0.2)', marginBottom: '20px' }}>
                    <Zap size={16} />
                    <span><strong>Dados carregados automaticamente</strong> — contrato ativo encontrado. Campos pré-preenchidos com condições vigentes.</span>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Imóvel Alvo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                  <select value={selectedPropertyId} onChange={e => handlePropertyChange(e.target.value)} required style={inputStyle}>
                    <option value="">-- Selecione o Imóvel --</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.status !== 'vacant' ? ' (Ocupado)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Inquilino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <select value={selectedTenantId} onChange={e => setSelectedTenantId(e.target.value)} required disabled={isOccupied} style={isOccupied ? inputReadonlyStyle : inputStyle}>
                      <option value="">-- Selecione o Inquilino --</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {isOccupied && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Preenchido pelo contrato ativo</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Locador (Perfil)</label>
                    <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} style={isOccupied && loadedFromLease?.landlord_profile_id ? inputReadonlyStyle : inputStyle}>
                      <option value="">Padrão do Sistema</option>
                      {landlordProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Valor R$ <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input type="number" step="0.01" value={rentValue} onChange={e => setRentValue(e.target.value)} required placeholder="5000.00" style={isOccupied ? inputReadonlyStyle : inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Vencimento (Dia) <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(parseInt(e.target.value) || 5)} required placeholder="05" style={isOccupied ? inputReadonlyStyle : inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Início Vigência <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={isOccupied ? inputReadonlyStyle : inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Início Faturamento <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Opcional)</span></label>
                    <input type="date" value={billingStartDate} onChange={e => setBillingStartDate(e.target.value)} style={isOccupied ? inputReadonlyStyle : inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Término Vigência <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Vazio = Indeterminado)</span></label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={isOccupied ? inputReadonlyStyle : inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={labelStyle}>Modelo Jurídico DOCX <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                  <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} required style={{ ...inputStyle, border: '1px solid rgba(74, 111, 255, 0.4)' }}>
                    <option value="">-- Selecione o Modelo --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {isOccupied && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Info size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <span>Modo <strong style={{ color: 'white' }}>Emissão de Documento</strong>: nenhum novo contrato será criado. O DOCX será gerado para o contrato já existente.</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '8px' }}>
                  <button type="button" onClick={() => { setIsOpen(false); resetForm() }} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                  <button type="button" onClick={handleNextStep} disabled={!selectedTemplateId || isLoadingLease} style={{ padding: '14px 28px', borderRadius: '12px', background: 'var(--accent-gradient)', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', opacity: (!selectedTemplateId || isLoadingLease) ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isLoadingLease ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2 ─────────────────────────────────────────────── */}
            {currentStep === 2 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '18px', color: 'white', fontWeight: 600 }}>Campos e Variáveis Parametrizadas</h3>
                  <span style={{ fontSize: '11px', background: 'rgba(0, 229, 155, 0.1)', color: 'var(--success-color)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>Autopreenchimento Ativo</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                  Variáveis mapeadas ao banco foram preenchidas automaticamente.{' '}
                  <strong style={{ color: 'var(--warning-color)' }}>Campos em branco</strong> precisam de preenchimento manual.
                </p>

                {isLoading ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Carregando variáveis do contrato...</p>
                ) : detectedVariables.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Info size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Nenhuma variável encontrada no template. Você pode avançar diretamente.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                    {detectedVariables.map(v => {
                      const isDbMapped = v.origin !== 'manual'
                      const isEmpty = !dynamicValues[v.code]
                      const isRequiredEmpty = v.is_required && isEmpty
                      return (
                        <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: isRequiredEmpty ? 'var(--warning-color)' : undefined }}>
                              {v.label || v.code}
                              {v.is_required && <span style={{ color: 'var(--danger-color)' }}> *</span>}
                            </span>
                            {isDbMapped
                              ? <span style={{ fontSize: '10px', color: 'var(--success-color)', background: 'rgba(0,229,155,0.05)', padding: '1px 4px', borderRadius: '3px' }}>Auto</span>
                              : isRequiredEmpty
                                ? <span style={{ fontSize: '10px', color: 'var(--warning-color)', background: 'rgba(255,184,74,0.08)', padding: '1px 4px', borderRadius: '3px' }}>Preencher</span>
                                : null
                            }
                          </label>
                          <input
                            type={v.field_type === 'date' ? 'date' : 'text'}
                            value={dynamicValues[v.code] || ''}
                            onChange={e => setDynamicValues(prev => ({ ...prev, [v.code]: e.target.value }))}
                            readOnly={isDbMapped}
                            placeholder={v.default_value || `Preencha ${(v.label || v.code).toLowerCase()}`}
                            style={{
                              ...inputStyle,
                              background: isDbMapped ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.4)',
                              border: isRequiredEmpty
                                ? '1px solid rgba(255,184,74,0.5)'
                                : isDbMapped ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(255,255,255,0.08)',
                              color: isDbMapped ? 'var(--text-secondary)' : 'white',
                              cursor: isDbMapped ? 'not-allowed' : 'text'
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                  <button type="button" onClick={handlePrevStep} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button type="button" onClick={handleNextStep} style={{ padding: '14px 28px', borderRadius: '12px', background: 'var(--accent-gradient)', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Visualizar <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 ─────────────────────────────────────────────── */}
            {currentStep === 3 && (
              <form onSubmit={handleSubmit}>
                <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '4px', fontWeight: 600 }}>Confirmação e Efetivação</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                  {isOccupied ? 'O documento DOCX será gerado para o contrato existente.' : 'Revise antes de criar o contrato e gerar o documento.'}
                </p>

                <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Imóvel:</span>
                      <strong style={{ color: 'white' }}>{properties.find(p => p.id === selectedPropertyId)?.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Inquilino:</span>
                      <strong style={{ color: 'white' }}>{tenants.find(t => t.id === selectedTenantId)?.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Valor do Aluguel:</span>
                      <strong style={{ color: 'var(--success-color)' }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(rentValue || '0'))}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Início Vigência:</span>
                      <strong style={{ color: 'white' }}>{startDate ? fmtDate(startDate) : '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Modo:</span>
                      <strong style={{ color: isOccupied ? 'var(--accent-color)' : 'var(--success-color)' }}>
                        {isOccupied ? '📄 Emissão de Documento' : '🆕 Novo Contrato + Documento'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Modelo DOCX:</span>
                      <strong style={{ color: 'white' }}>{templates.find(t => t.id === selectedTemplateId)?.name}</strong>
                    </div>
                  </div>
                </div>

                {detectedVariables.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variáveis Mapeadas</span>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', background: 'rgba(0,0,0,0.1)', padding: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12px' }}>
                        {detectedVariables.map(v => (
                          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{v.label || v.code}:</span>
                            <span style={{ color: dynamicValues[v.code] ? 'white' : 'var(--danger-color)', fontWeight: 500 }}>
                              {dynamicValues[v.code] || '⚠ Vazio'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ padding: '12px 16px', background: 'rgba(74, 111, 255, 0.05)', color: 'var(--accent-color)', borderRadius: '12px', fontSize: '12px', border: '1px solid rgba(74,111,255,0.15)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Info size={16} />
                  <span>Ao confirmar, o arquivo DOCX será gerado e ficará disponível para download no painel do contrato.</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                  <button type="button" onClick={handlePrevStep} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button type="submit" disabled={isLoading} style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', background: 'var(--success-bg)', color: 'var(--success-color)', fontWeight: 'bold', cursor: 'pointer', opacity: isLoading ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {isLoading ? 'Gerando documento...' : isOccupied ? 'Gerar Documento DOCX' : 'Efetivar Contrato'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

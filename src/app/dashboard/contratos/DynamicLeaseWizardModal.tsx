'use client'

import { useState, useEffect } from 'react'
import { Plus, X, ChevronRight, ChevronLeft, FileText, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import styles from '../../page.module.css'
import { createLeaseAction, getContractTemplatesAction, getTemplateVariablesAction } from './actions'

interface Props {
  properties: { id: string; name: string; status: string; address?: string | null; city?: string | null; state?: string | null }[]
  tenants: { id: string; name: string; document?: string | null; email?: string | null; phone?: string | null }[]
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

export default function DynamicLeaseWizardModal({ properties, tenants, landlordProfiles }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [templates, setTemplates] = useState<Template[]>([])
  const [detectedVariables, setDetectedVariables] = useState<TemplateVariable[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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

  const vacantProperties = properties.filter(p => p.status === 'vacant')

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    const data = await getContractTemplatesAction()
    setTemplates(data as Template[])
  }

  // Monitora seleção de template para buscar variáveis dinâmicas
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

  // Resolver dados do banco de dados para autopreenchimento inteligente
  useEffect(() => {
    if (!selectedTenantId && !selectedPropertyId) return

    const tenant = tenants.find(t => t.id === selectedTenantId)
    const property = properties.find(p => p.id === selectedPropertyId)
    const profile = landlordProfiles.find(p => p.id === selectedProfileId) || landlordProfiles.find(p => p.is_default)

    const initialValues: Record<string, string> = {}

    detectedVariables.forEach(v => {
      let resolvedValue = ''

      switch (v.origin) {
        case 'db_tenant_name':
          resolvedValue = tenant?.name || ''
          break
        case 'db_tenant_document':
          resolvedValue = tenant?.document || ''
          break
        case 'db_tenant_email':
          resolvedValue = tenant?.email || ''
          break
        case 'db_tenant_phone':
          resolvedValue = tenant?.phone || ''
          break
        case 'db_landlord_name':
          resolvedValue = profile?.name || ''
          break
        case 'db_landlord_document':
          resolvedValue = profile?.document || ''
          break
        case 'db_landlord_email':
          resolvedValue = profile?.email || ''
          break
        case 'db_landlord_phone':
          resolvedValue = profile?.phone || ''
          break
        case 'db_landlord_address':
          resolvedValue = profile?.address || ''
          break
        case 'db_property_name':
          resolvedValue = property?.name || ''
          break
        case 'db_property_address':
          resolvedValue = [
            property?.address,
            property?.city && property?.state ? `${property.city} - ${property.state}` : (property?.city ?? property?.state)
          ].filter(Boolean).join(', ')
          break
        case 'db_rent_value':
          resolvedValue = rentValue ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(rentValue)) : ''
          break
        case 'db_due_day':
          resolvedValue = dueDay ? String(dueDay).padStart(2, '0') : ''
          break
        case 'db_start_date':
          resolvedValue = startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : ''
          break
        case 'db_end_date':
          resolvedValue = endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Indeterminado'
          break
        default:
          resolvedValue = dynamicValues[v.code] || v.default_value || ''
      }

      initialValues[v.code] = resolvedValue
    })

    setDynamicValues(prev => ({ ...prev, ...initialValues }))
  }, [selectedTenantId, selectedPropertyId, selectedProfileId, rentValue, dueDay, startDate, endDate, detectedVariables])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    // Validar variáveis obrigatórias
    const missing = detectedVariables.filter(v => v.is_required && !dynamicValues[v.code])
    if (missing.length > 0) {
      setErrorMsg(`Preencha todos os campos obrigatórios: ${missing.map(m => m.label).join(', ')}`)
      setIsLoading(false)
      return
    }

    try {
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

      // Executa criação do lease original (automóvel transacional)
      const result = await createLeaseAction(formData)

      if (typeof result === 'string') {
        setErrorMsg(result)
        setIsLoading(false)
        return
      }

      setSuccessMsg('Contrato de Locação efetivado com sucesso!')
      setTimeout(() => {
        setIsOpen(false)
        setCurrentStep(1)
        setSelectedPropertyId('')
        setSelectedTenantId('')
        setSelectedTemplateId('')
        setRentValue('')
        setStartDate('')
        setEndDate('')
        setSuccessMsg('')
      }, 1500)

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao efetivar contrato.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
    padding: '14px', borderRadius: '12px', color: 'white', outline: 'none', width: '100%', boxSizing: 'border-box'
  }
  const labelStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 500 }

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); setCurrentStep(1); setErrorMsg(''); setSuccessMsg('') }}
        className={styles.btnPrimary}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none' }}
      >
        <Plus size={16} />
        Emissão Parametrizada
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', backgroundColor: 'rgba(25, 28, 38, 0.95)', padding: '32px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box', marginBottom: '40px' }}>

            <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ position: 'absolute', top: '28px', right: '28px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>

            {/* Steps Progress Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '28px', height: '28px', background: currentStep >= 1 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>1</span>
                  <span style={{ fontSize: '13px', fontWeight: currentStep === 1 ? 600 : 400, color: currentStep === 1 ? 'white' : 'var(--text-secondary)' }}>Vínculos</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '28px', height: '28px', background: currentStep >= 2 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>2</span>
                  <span style={{ fontSize: '13px', fontWeight: currentStep === 2 ? 600 : 400, color: currentStep === 2 ? 'white' : 'var(--text-secondary)' }}>Formulário</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '28px', height: '28px', background: currentStep >= 3 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>3</span>
                  <span style={{ fontSize: '13px', fontWeight: currentStep === 3 ? 600 : 400, color: currentStep === 3 ? 'white' : 'var(--text-secondary)' }}>Efetivar</span>
                </div>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Passo {currentStep} de 3</span>
            </div>

            {errorMsg && (
              <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: '12px', fontSize: '13px', border: '1px solid rgba(255,74,107,0.2)', marginBottom: '20px' }}>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: '12px', fontSize: '13px', border: '1px solid rgba(0,229,155,0.2)', marginBottom: '20px' }}>
                <CheckCircle2 size={16} />
                {successMsg}
              </div>
            )}

            {/* STEP 1: BASE VINCULUM */}
            {currentStep === 1 && (
              <div>
                <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '8px', fontWeight: 600 }}>Parâmetros do Contrato</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Selecione o imóvel vago, inquilino e as condições iniciais de locação.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Imóvel Alvo (Vago) <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <select value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)} required style={inputStyle}>
                      <option value="">-- Selecione o Imóvel --</option>
                      {vacantProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Inquilino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <select value={selectedTenantId} onChange={e => setSelectedTenantId(e.target.value)} required style={inputStyle}>
                      <option value="">-- Selecione o Inquilino --</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Valor R$ <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input type="number" step="0.01" value={rentValue} onChange={e => setRentValue(e.target.value)} required placeholder="5000.00" style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Vencimento (Dia) <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(parseInt(e.target.value) || 5)} required placeholder="05" style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Início Vigência <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Início Faturamento <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Opcional)</span></label>
                    <input type="date" value={billingStartDate} onChange={e => setBillingStartDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Término Vigência <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Vazio = Indeterminado)</span></label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Locador (Perfil)</label>
                    <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} style={inputStyle}>
                      <option value="">Padrão do Sistema</option>
                      {landlordProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Modelo Jurídico DOCX <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} required style={{ ...inputStyle, border: '1px solid rgba(74, 111, 255, 0.4)' }}>
                      <option value="">-- Selecione o Modelo --</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                {vacantProperties.length === 0 && (
                  <div style={{ padding: '12px', background: 'var(--warning-bg)', color: 'var(--warning-color)', borderRadius: '12px', fontSize: '13px', border: '1px solid rgba(255,184,74,0.15)', marginBottom: '20px' }}>
                    Nenhum imóvel vago disponível para alocação.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px' }}>
                  <button type="button" onClick={() => setIsOpen(false)} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!selectedTemplateId}
                    style={{
                      padding: '14px 28px',
                      borderRadius: '12px',
                      background: 'var(--accent-gradient)',
                      color: 'white',
                      fontWeight: 'bold',
                      opacity: !selectedTemplateId ? 0.3 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DYNAMIC FORM MAPPING */}
            {currentStep === 2 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '18px', color: 'white', fontWeight: 600 }}>Campos e Variáveis Parametrizadas</h3>
                  <span style={{ fontSize: '11px', background: 'rgba(0, 229, 155, 0.1)', color: 'var(--success-color)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>Autopreenchimento Ativo</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Variáveis mapeadas ao banco de dados foram preenchidas automaticamente. Complete as informações manuais pendentes.</p>

                {isLoading ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Carregando variáveis do contrato...</p>
                ) : detectedVariables.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Info size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Nenhuma variável encontrada no template. Você pode avançar diretamente.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                    {detectedVariables.map(v => {
                      const isDbMapped = v.origin !== 'manual'
                      return (
                        <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>
                              {v.label} {v.is_required && <span style={{ color: 'var(--danger-color)' }}>*</span>}
                            </span>
                            {isDbMapped && (
                              <span style={{ fontSize: '10px', color: 'var(--success-color)', background: 'rgba(0,229,155,0.05)', padding: '1px 4px', borderRadius: '3px' }}>
                                Auto
                              </span>
                            )}
                          </label>
                          <input
                            type={v.field_type === 'date' ? 'date' : 'text'}
                            value={dynamicValues[v.code] || ''}
                            onChange={e => setDynamicValues(prev => ({ ...prev, [v.code]: e.target.value }))}
                            readOnly={isDbMapped}
                            placeholder={v.default_value || `Preencha ${v.label.toLowerCase()}`}
                            style={{
                              ...inputStyle,
                              background: isDbMapped ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.4)',
                              border: isDbMapped ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(255,255,255,0.08)',
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
                  <button type="button" onClick={handlePrevStep} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    style={{
                      padding: '14px 28px',
                      borderRadius: '12px',
                      background: 'var(--accent-gradient)',
                      color: 'white',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Visualizar <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PREVIEW AND EMIT */}
            {currentStep === 3 && (
              <form onSubmit={handleSubmit}>
                <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '8px', fontWeight: 600 }}>Confirmação e Efetivação</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Revise o resumo do contrato parametrizado antes de gerar o documento físico.</p>

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
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(rentValue))}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Data de Início:</span>
                      <strong style={{ color: 'white' }}>{new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
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
                            <span style={{ color: 'var(--text-muted)' }}>{v.label}:</span>
                            <span style={{ color: 'white', fontWeight: 500 }}>{dynamicValues[v.code] || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ padding: '12px 16px', background: 'rgba(74, 111, 255, 0.05)', color: 'var(--accent-color)', borderRadius: '12px', fontSize: '12px', border: '1px solid rgba(74,111,255,0.15)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Info size={16} />
                  <span>Ao confirmar, as transações e o arquivo DOCX/PDF serão gerados pelo motor jurídico.</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                  <button type="button" onClick={handlePrevStep} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      padding: '14px 28px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'var(--success-bg)',
                      color: 'var(--success-color)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: isLoading ? 0.3 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isLoading ? 'Emitindo...' : 'Efetivar Contrato'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

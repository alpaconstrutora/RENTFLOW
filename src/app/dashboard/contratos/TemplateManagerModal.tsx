'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Upload, Plus, Trash2, CheckCircle2, ChevronRight, Settings, Edit3 } from 'lucide-react'
import Pizzip from 'pizzip'
import styles from '../../page.module.css'
import {
  getContractTemplatesAction,
  createContractTemplateAction,
  deleteContractTemplateAction,
  uploadTemplateFileAction,
  updateContractTemplateAction,
  getTemplateVariablesAction
} from './actions'

interface Template {
  id: string
  name: string
  category: string
  docx_storage_path: string
  status: string
  version: string
  created_at: string
}

interface VariableMapping {
  code: string
  label: string
  field_type: string
  is_required: boolean
  origin: string
  default_value: string
}

export default function TemplateManagerModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'upload'>('list')
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)

  // Form states
  const [templateName, setTemplateName] = useState('')
  const [category, setCategory] = useState('locacao')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [detectedVariables, setDetectedVariables] = useState<VariableMapping[]>([])

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    setIsLoading(true)
    const data = await getContractTemplatesAction()
    setTemplates(data as Template[])
    setIsLoading(false)
  }

  // Heurística de pré-mapeamento inteligente para encantar o usuário
  const suggestMapping = (code: string): { origin: string; label: string; field_type: string } => {
    const clean = code.toUpperCase().replace(/[^A-Z0-9_]/g, '')
    
    if (clean.includes('LOCATARIO_NOME') || (clean.includes('LOCATARIO') && clean.includes('NOME'))) {
      return { origin: 'db_tenant_name', label: 'Nome do Locatário', field_type: 'text' }
    }
    if (clean.includes('LOCADOR_NOME') || (clean.includes('LOCADOR') && clean.includes('NOME')) || clean.includes('PROPRIETARIO_NOME')) {
      return { origin: 'db_landlord_name', label: 'Nome do Locador', field_type: 'text' }
    }
    if (clean.includes('LOCATARIO_CPF') || clean.includes('LOCATARIO_CNPJ') || clean.includes('LOCATARIO_DOCUMENTO') || (clean.includes('LOCATARIO') && clean.includes('DOC'))) {
      return { origin: 'db_tenant_document', label: 'CPF/CNPJ do Locatário', field_type: 'cpf_cnpj' }
    }
    if (clean.includes('LOCATARIO_RG') || (clean.includes('LOCATARIO') && clean.includes('RG'))) {
      return { origin: 'db_tenant_rg', label: 'RG do Locatário', field_type: 'text' }
    }
    if (clean.includes('LOCADOR_DOCUMENTO') || clean.includes('LOCADOR_CPF') || clean.includes('LOCADOR_CNPJ') || (clean.includes('LOCADOR') && clean.includes('DOC'))) {
      return { origin: 'db_landlord_document', label: 'CPF/CNPJ do Locador', field_type: 'cpf_cnpj' }
    }
    if (clean.includes('LOCATARIO_EMAIL') || (clean.includes('LOCATARIO') && clean.includes('EMAIL'))) {
      return { origin: 'db_tenant_email', label: 'E-mail do Locatário', field_type: 'email' }
    }
    if (clean.includes('LOCADOR_EMAIL') || (clean.includes('LOCADOR') && clean.includes('EMAIL'))) {
      return { origin: 'db_landlord_email', label: 'E-mail do Locador', field_type: 'email' }
    }
    if (clean.includes('LOCATARIO_FONE') || clean.includes('LOCATARIO_TEL') || (clean.includes('LOCATARIO') && clean.includes('TELEFONE'))) {
      return { origin: 'db_tenant_phone', label: 'Telefone do Locatário', field_type: 'phone' }
    }
    if (clean.includes('LOCADOR_FONE') || clean.includes('LOCADOR_TEL') || (clean.includes('LOCADOR') && clean.includes('TELEFONE'))) {
      return { origin: 'db_landlord_phone', label: 'Telefone do Locador', field_type: 'phone' }
    }
    if (clean.includes('LOCATARIO_NASCIMENTO') || clean.includes('DATA_NASCIMENTO') || (clean.includes('LOCATARIO') && clean.includes('NASC'))) {
      return { origin: 'db_tenant_birth_date', label: 'Data de Nascimento', field_type: 'date' }
    }
    if (clean.includes('LOCATARIO_PROFISSAO') || (clean.includes('LOCATARIO') && clean.includes('PROF'))) {
      return { origin: 'db_tenant_profession', label: 'Profissão do Locatário', field_type: 'text' }
    }
    if (clean.includes('LOCATARIO_NACIONALIDADE') || (clean.includes('LOCATARIO') && clean.includes('NACION'))) {
      return { origin: 'db_tenant_nationality', label: 'Nacionalidade do Locatário', field_type: 'text' }
    }
    if (clean.includes('ESTADO_CIVIL') || clean.includes('LOCATARIO_ESTADO_CIVIL') || (clean.includes('LOCATARIO') && clean.includes('CIVIL'))) {
      return { origin: 'db_tenant_marital_status', label: 'Estado Civil do Locatário', field_type: 'text' }
    }
    if (clean.includes('LOCATARIO_ENDERECO') || (clean.includes('LOCATARIO') && clean.includes('END'))) {
      return { origin: 'db_tenant_address', label: 'Endereço do Locatário', field_type: 'text' }
    }
    if (clean.includes('LOCATARIO_CEP') || (clean.includes('LOCATARIO') && clean.includes('CEP'))) {
      return { origin: 'db_tenant_zip_code', label: 'CEP do Locatário', field_type: 'text' }
    }
    if (clean.includes('FIADOR_NOME') || (clean.includes('FIADOR') && clean.includes('NOME'))) {
      return { origin: 'db_guarantor_name', label: 'Nome do Fiador', field_type: 'text' }
    }
    if (clean.includes('FIADOR_CPF') || clean.includes('FIADOR_DOCUMENTO') || (clean.includes('FIADOR') && clean.includes('DOC'))) {
      return { origin: 'db_guarantor_document', label: 'CPF/CNPJ do Fiador', field_type: 'cpf_cnpj' }
    }
    if (clean.includes('IMOVEL_NOME') || clean.includes('NOME_IMOVEL') || (clean.includes('IMOVEL') && clean.includes('NOME'))) {
      return { origin: 'db_property_name', label: 'Nome / Identificação do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_TIPO') || (clean.includes('IMOVEL') && clean.includes('TIPO'))) {
      return { origin: 'db_property_type', label: 'Tipo do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_ENDERECO') || clean.includes('IMOVEL_RUA') || (clean.includes('IMOVEL') && clean.includes('END'))) {
      return { origin: 'db_property_address', label: 'Endereço Completo do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_LOGRADOURO') || clean.includes('IMOVEL_RUA') || (clean.includes('IMOVEL') && clean.includes('LOGRADOURO'))) {
      return { origin: 'db_property_street', label: 'Logradouro do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_BAIRRO') || (clean.includes('IMOVEL') && clean.includes('BAIRRO'))) {
      return { origin: 'db_property_district', label: 'Bairro do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_CIDADE') || (clean.includes('IMOVEL') && clean.includes('CIDADE'))) {
      return { origin: 'db_property_city', label: 'Cidade do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_ESTADO') || clean.includes('IMOVEL_UF') || (clean.includes('IMOVEL') && (clean.includes('ESTADO') || clean.includes('UF')))) {
      return { origin: 'db_property_state', label: 'Estado (UF) do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_CEP') || (clean.includes('IMOVEL') && clean.includes('CEP'))) {
      return { origin: 'db_property_zip_code', label: 'CEP do Imóvel', field_type: 'text' }
    }
    if (clean.includes('LOCADOR_ENDERECO') || (clean.includes('LOCADOR') && clean.includes('END')) || clean.includes('PROPRIETARIO_ENDERECO')) {
      return { origin: 'db_landlord_address', label: 'Endereço do Locador', field_type: 'text' }
    }
    if (clean.includes('VALOR_ALUGUEL') || clean.includes('ALUGUEL_VALOR') || clean.includes('RENT')) {
      return { origin: 'db_rent_value', label: 'Valor do Aluguel', field_type: 'currency' }
    }
    if (clean.includes('DIA_VENCIMENTO') || clean.includes('VENCIMENTO') || clean.includes('DUE_DAY')) {
      return { origin: 'db_due_day', label: 'Dia do Vencimento', field_type: 'number' }
    }
    if (clean.includes('DATA_INICIO') || clean.includes('INICIO_VIGENCIA') || clean.includes('START_DATE')) {
      return { origin: 'db_start_date', label: 'Data de Início de Vigência', field_type: 'date' }
    }
    if (clean.includes('DATA_FIM') || clean.includes('TERMINO_VIGENCIA') || clean.includes('END_DATE')) {
      return { origin: 'db_end_date', label: 'Data de Término de Vigência', field_type: 'date' }
    }

    // Fallback amigável
    return { 
      origin: 'manual', 
      label: code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), 
      field_type: 'text' 
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg('Por favor, selecione apenas arquivos do Microsoft Word (.docx).')
      return
    }

    setErrorMsg('')
    setSelectedFile(file)
    if (!editingTemplateId || !templateName) {
      setTemplateName(file.name.replace(/\.docx$/i, ''))
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const zip = new Pizzip(arrayBuffer)
        const docXml = zip.files['word/document.xml'].asText()

        // Remove ALL XML tags to flatten the document content and get pure text.
        // This solves the classic Word split run issue (spelling check, font changes, formatting splits).
        const cleanText = docXml.replace(/<[^>]+>/g, '')

        const handlebarsRegex = /\{\{([^}]+)\}\}/g
        const legacyRegex = /##P\{([^}]+)\}##/g
        const variables = new Set<string>()
        let match

        while ((match = handlebarsRegex.exec(cleanText)) !== null) {
          variables.add(match[1].trim())
        }

        while ((match = legacyRegex.exec(cleanText)) !== null) {
          variables.add(match[1].trim())
        }

        const initialMappings = Array.from(variables).map(code => {
          const suggestions = suggestMapping(code)
          return {
            code,
            label: suggestions.label,
            field_type: suggestions.field_type,
            is_required: true,
            origin: suggestions.origin,
            default_value: ''
          }
        })

        setDetectedVariables(initialMappings)
      } catch (err) {
        setErrorMsg('Erro ao analisar o arquivo DOCX. Certifique-se de que não esteja corrompido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleUpdateVariable = (index: number, field: keyof VariableMapping, value: any) => {
    setDetectedVariables(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  }

  const handleTabChange = (tab: 'list' | 'upload') => {
    setActiveTab(tab)
    setErrorMsg('')
    setSuccessMsg('')
    if (tab === 'list') {
      setEditingTemplateId(null)
      setTemplateName('')
      setSelectedFile(null)
      setDetectedVariables([])
    }
  }

  const handleEditTemplateClick = async (t: Template) => {
    setIsLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    setEditingTemplateId(t.id)
    setTemplateName(t.name)
    setCategory(t.category)
    
    try {
      const vars = await getTemplateVariablesAction(t.id)
      setDetectedVariables(vars.map((v: any) => ({
        code: v.code,
        label: v.label,
        field_type: v.field_type,
        is_required: v.is_required,
        origin: v.origin,
        default_value: v.default_value || ''
      })))
      setActiveTab('upload')
    } catch (err: any) {
      setErrorMsg(`Erro ao carregar variáveis: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateName) {
      setErrorMsg('Preencha o nome do modelo.')
      return
    }
    if (!editingTemplateId && !selectedFile) {
      setErrorMsg('Por favor, selecione o arquivo do Word (.docx) para o novo modelo.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      let storagePath: string | null = null

      if (selectedFile) {
        // Converter arquivo para base64 e fazer upload
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(',')[1]
            resolve(base64)
          }
          reader.readAsDataURL(selectedFile)
        })

        const base64Data = await base64Promise

        const uploadRes = await uploadTemplateFileAction(selectedFile.name, base64Data)
        if ('error' in uploadRes) {
          setErrorMsg(`Erro de upload: ${uploadRes.error}`)
          setIsLoading(false)
          return
        }

        storagePath = uploadRes.storagePath!
      }

      let result
      if (editingTemplateId) {
        result = await updateContractTemplateAction(
          editingTemplateId,
          templateName,
          category,
          storagePath,
          detectedVariables
        )
      } else {
        result = await createContractTemplateAction(
          templateName,
          category,
          storagePath!,
          detectedVariables
        )
      }

      if (typeof result === 'string') {
        setErrorMsg(result)
      } else {
        setSuccessMsg(editingTemplateId ? 'Modelo jurídico atualizado com sucesso!' : 'Modelo e variáveis cadastrados com sucesso!')
        setTemplateName('')
        setEditingTemplateId(null)
        setSelectedFile(null)
        setDetectedVariables([])
        setActiveTab('list')
        loadTemplates()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro durante o salvamento.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Deseja realmente deletar este modelo de contrato?')) return
    setIsLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    const err = await deleteContractTemplateAction(id)
    setIsLoading(false)

    if (err) {
      setErrorMsg(err)
    } else {
      setSuccessMsg('Modelo excluído com sucesso.')
      loadTemplates()
    }
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'locacao': return 'Locação'
      case 'prestacao_servicos': return 'Prestação de Serviços'
      case 'empreitada': return 'Empreitada'
      case 'nda': return 'NDA / Confidencialidade'
      default: return cat.toUpperCase()
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
    padding: '12px 14px', borderRadius: '10px', color: 'white', outline: 'none', width: '100%', boxSizing: 'border-box'
  }
  const labelStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 500 }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={styles.btnPrimary}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          border: 'none',
          background: 'rgba(255,255,255,0.03)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'none',
          color: 'var(--text-secondary)'
        }}
      >
        <Settings size={16} />
        Modelos de Contratos
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '960px', backgroundColor: 'rgba(25, 28, 38, 0.95)', padding: '32px', position: 'relative', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,1)', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box', marginBottom: '40px' }}>
            
            <button type="button" onClick={() => setIsOpen(false)} style={{ position: 'absolute', top: '28px', right: '28px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'white'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <X size={24} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div className={styles.iconWrapper} style={{ background: 'rgba(74, 111, 255, 0.1)', color: 'var(--accent-color)' }}>
                <FileText size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color: 'white', margin: 0 }}>Modelos de Contratos & Variáveis</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>Gerencie as minutas padrão no formato DOCX e mapeie as variáveis para autopreenchimento.</p>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '24px 0', gap: '20px' }}>
              <button
                type="button"
                onClick={() => handleTabChange('list')}
                style={{
                  padding: '12px 6px',
                  color: activeTab === 'list' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'list' ? '2px solid var(--accent-color)' : '2px solid transparent',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                Modelos Salvos
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('upload')}
                style={{
                  padding: '12px 6px',
                  color: activeTab === 'upload' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'upload' ? '2px solid var(--accent-color)' : '2px solid transparent',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                {editingTemplateId ? 'Editar Modelo' : 'Subir Novo DOCX'}
              </button>
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

            {/* TAB: LIST */}
            {activeTab === 'list' && (
              <div>
                {isLoading ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Carregando modelos salvos...</p>
                ) : templates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 40px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '16px' }}>
                    <Upload size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 500, margin: '0 0 8px 0' }}>Nenhum modelo de contrato cadastrado</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 20px 0' }}>Cadastre suas minutas jurídicas para habilitar a emissão inteligente.</p>
                    <button type="button" onClick={() => setActiveTab('upload')} className={styles.btnPrimary} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={14} /> Cadastrar Primeiro Modelo
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {templates.map(t => (
                      <div key={t.id} className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={20} color="var(--accent-color)" />
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: 'white', display: 'block', fontSize: '14px' }}>{t.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>
                              {getCategoryLabel(t.category)}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Versão {t.version}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleEditTemplateClick(t)}
                            style={{ color: 'var(--accent-color)', padding: '8px', borderRadius: '8px', background: 'transparent', transition: 'all 0.2s', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(74, 111, 255, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleDeleteTemplate(t.id)}
                            style={{ color: 'var(--danger-color)', padding: '8px', borderRadius: '8px', background: 'transparent', transition: 'all 0.2s', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: UPLOAD / REGISTER */}
            {activeTab === 'upload' && (
              <form onSubmit={handleUploadAndSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Nome do Modelo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Contrato de Aluguel Residencial Padrão"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Categoria Jurídica <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="locacao">Locação</option>
                      <option value="prestacao_servicos">Prestação de Serviços</option>
                      <option value="empreitada">Empreitada</option>
                      <option value="nda">NDA / Confidencialidade</option>
                    </select>
                  </div>
                </div>

                {/* File Dropzone */}
                <div 
                  style={{ 
                    border: selectedFile 
                      ? '1px solid rgba(0, 229, 155, 0.3)' 
                      : editingTemplateId 
                        ? '1px dashed rgba(74, 111, 255, 0.3)' 
                        : '1px dashed rgba(255,255,255,0.15)',
                    background: selectedFile 
                      ? 'rgba(0, 229, 155, 0.02)' 
                      : editingTemplateId 
                        ? 'rgba(74, 111, 255, 0.02)' 
                        : 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                    padding: '32px',
                    textAlign: 'center',
                    marginBottom: '24px',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="file"
                    accept=".docx"
                    onChange={handleFileChange}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                  <Upload 
                    size={32} 
                    style={{ 
                      color: selectedFile 
                        ? 'var(--success-color)' 
                        : editingTemplateId 
                          ? 'var(--accent-color)' 
                          : 'var(--text-muted)', 
                      marginBottom: '12px' 
                    }} 
                  />
                  {selectedFile ? (
                    <div>
                      <p style={{ color: 'white', fontWeight: 600, margin: '0 0 4px 0', fontSize: '14px' }}>Arquivo carregado com sucesso!</p>
                      <p style={{ color: 'var(--success-color)', fontSize: '12px', margin: 0, fontWeight: 500 }}>{selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</p>
                    </div>
                  ) : editingTemplateId ? (
                    <div>
                      <p style={{ color: 'white', fontWeight: 600, margin: '0 0 4px 0', fontSize: '14px' }}>Documento DOCX atual preservado</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>Arraste ou selecione um novo arquivo se desejar substituir o documento atual.</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: 'var(--text-secondary)', fontWeight: 500, margin: '0 0 4px 0', fontSize: '14px' }}>Selecione ou arraste o arquivo do Word (.docx)</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0 }}>O parser lerá as variáveis semânticas para mapeamento automático.</p>
                    </div>
                  )}
                </div>

                {/* Detected variables table */}
                {detectedVariables.length > 0 && (
                  <div style={{ marginTop: '32px' }}>
                    <h3 style={{ fontSize: '16px', color: 'white', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="var(--accent-color)" />
                      Campos Detectados no Documento ({detectedVariables.length})
                    </h3>

                    <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ padding: '12px 16px' }}>Código da Variável</th>
                            <th style={{ padding: '12px 16px' }}>Etiqueta (Label)</th>
                            <th style={{ padding: '12px 16px' }}>Tipo de Campo</th>
                            <th style={{ padding: '12px 16px' }}>Origem Automática</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Obrigt.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detectedVariables.map((v, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--accent-color)', fontWeight: 600 }}>
                                {v.code}
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                <input
                                  type="text"
                                  value={v.label}
                                  onChange={e => handleUpdateVariable(idx, 'label', e.target.value)}
                                  style={{ ...inputStyle, padding: '6px 10px', borderRadius: '6px', fontSize: '13px' }}
                                />
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                <select
                                  value={v.field_type}
                                  onChange={e => handleUpdateVariable(idx, 'field_type', e.target.value)}
                                  style={{ ...inputStyle, padding: '6px 10px', borderRadius: '6px', fontSize: '13px' }}
                                >
                                  <option value="text">Texto livre</option>
                                  <option value="number">Número</option>
                                  <option value="currency">Moeda R$</option>
                                  <option value="percentage">Percentual %</option>
                                  <option value="date">Data</option>
                                  <option value="cpf_cnpj">CPF / CNPJ</option>
                                  <option value="cep">CEP</option>
                                  <option value="phone">Telefone</option>
                                  <option value="email">E-mail</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                <select
                                   value={v.origin}
                                   onChange={e => handleUpdateVariable(idx, 'origin', e.target.value)}
                                   style={{ ...inputStyle, padding: '6px 10px', borderRadius: '6px', fontSize: '13px', colorScheme: 'dark' }}
                                 >
                                   <option value="manual">Manual (Digitado na hora)</option>
                                   <optgroup label="Dados do Inquilino">
                                     <option value="db_tenant_name">Inquilino: Nome completo</option>
                                     <option value="db_tenant_document">Inquilino: CPF/CNPJ</option>
                                     <option value="db_tenant_rg">Inquilino: RG</option>
                                     <option value="db_tenant_email">Inquilino: E-mail</option>
                                     <option value="db_tenant_phone">Inquilino: Telefone</option>
                                     <option value="db_tenant_birth_date">Inquilino: Data de Nascimento</option>
                                     <option value="db_tenant_profession">Inquilino: Profissão</option>
                                     <option value="db_tenant_nationality">Inquilino: Nacionalidade</option>
                                     <option value="db_tenant_marital_status">Inquilino: Estado Civil</option>
                                     <option value="db_tenant_address">Inquilino: Endereço completo</option>
                                     <option value="db_tenant_zip_code">Inquilino: CEP</option>
                                   </optgroup>
                                   <optgroup label="Dados do Fiador">
                                     <option value="db_guarantor_name">Fiador: Nome completo</option>
                                     <option value="db_guarantor_document">Fiador: CPF/CNPJ</option>
                                   </optgroup>
                                   <optgroup label="Dados do Locador">
                                     <option value="db_landlord_name">Locador: Nome / Razão Social</option>
                                     <option value="db_landlord_document">Locador: CPF/CNPJ</option>
                                     <option value="db_landlord_email">Locador: E-mail</option>
                                     <option value="db_landlord_phone">Locador: Telefone</option>
                                     <option value="db_landlord_address">Locador: Endereço completo</option>
                                   </optgroup>
                                   <optgroup label="Dados do Imóvel">
                                     <option value="db_property_name">Imóvel: Identificação / Nome</option>
                                     <option value="db_property_type">Imóvel: Tipo (Apto, Casa, Loja…)</option>
                                     <option value="db_property_address">Imóvel: Endereço completo</option>
                                     <option value="db_property_street">Imóvel: Logradouro (Rua/Av.)</option>
                                     <option value="db_property_district">Imóvel: Bairro</option>
                                     <option value="db_property_city">Imóvel: Cidade</option>
                                     <option value="db_property_state">Imóvel: Estado (UF)</option>
                                     <option value="db_property_zip_code">Imóvel: CEP</option>
                                   </optgroup>
                                   <optgroup label="Dados Comerciais do Contrato">
                                     <option value="db_rent_value">Contrato: Valor do aluguel</option>
                                     <option value="db_due_day">Contrato: Dia de vencimento</option>
                                     <option value="db_start_date">Contrato: Início vigência</option>
                                     <option value="db_end_date">Contrato: Término vigência</option>
                                   </optgroup>
                                 </select>
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={v.is_required}
                                  onChange={e => handleUpdateVariable(idx, 'is_required', e.target.checked)}
                                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => handleTabChange('list')}
                    style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || (!editingTemplateId && !selectedFile)}
                    style={{
                      padding: '14px 28px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'var(--success-bg)',
                      color: 'var(--success-color)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: (isLoading || (!editingTemplateId && !selectedFile)) ? 0.3 : 1,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isLoading ? 'Salvando Modelo...' : 'Salvar Modelo Jurídico'}
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

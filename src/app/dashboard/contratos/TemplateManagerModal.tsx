'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Upload, Plus, Trash2, CheckCircle2, ChevronRight, Settings } from 'lucide-react'
import Pizzip from 'pizzip'
import styles from '../../page.module.css'
import {
  getContractTemplatesAction,
  createContractTemplateAction,
  deleteContractTemplateAction,
  uploadTemplateFileAction
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
    if (clean.includes('LOCATARIO_DOCUMENTO') || clean.includes('LOCATARIO_CPF') || clean.includes('LOCATARIO_CNPJ') || (clean.includes('LOCATARIO') && clean.includes('DOC'))) {
      return { origin: 'db_tenant_document', label: 'CPF/CNPJ do Locatário', field_type: 'cpf_cnpj' }
    }
    if (clean.includes('LOCATARIO_EMAIL') || (clean.includes('LOCATARIO') && clean.includes('EMAIL'))) {
      return { origin: 'db_tenant_email', label: 'E-mail do Locatário', field_type: 'email' }
    }
    if (clean.includes('LOCATARIO_FONE') || clean.includes('LOCATARIO_TEL') || (clean.includes('LOCATARIO') && clean.includes('TELEFONE'))) {
      return { origin: 'db_tenant_phone', label: 'Telefone do Locatário', field_type: 'phone' }
    }
    if (clean.includes('IMOVEL_NOME') || clean.includes('NOME_IMOVEL') || (clean.includes('IMOVEL') && clean.includes('NOME'))) {
      return { origin: 'db_property_name', label: 'Nome do Imóvel', field_type: 'text' }
    }
    if (clean.includes('IMOVEL_ENDERECO') || clean.includes('IMOVEL_RUA') || (clean.includes('IMOVEL') && clean.includes('END'))) {
      return { origin: 'db_property_address', label: 'Endereço do Imóvel', field_type: 'text' }
    }
    if (clean.includes('VALOR_ALUGUEL') || clean.includes('ALUGUEL_VALOR') || clean.includes('VALOR') || clean.includes('RENT')) {
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
    setTemplateName(file.name.replace(/\.docx$/i, ''))

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const zip = new Pizzip(arrayBuffer)
        const docXml = zip.files['word/document.xml'].asText()

        const handlebarsRegex = /\{\{([^}]+)\}\}/g
        const legacyRegex = /##P\{([^}]+)\}##/g
        const variables = new Set<string>()
        let match

        while ((match = handlebarsRegex.exec(docXml)) !== null) {
          variables.add(match[1].trim())
        }

        while ((match = legacyRegex.exec(docXml)) !== null) {
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

  const handleUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !templateName) {
      setErrorMsg('Preencha o nome do modelo e selecione o arquivo.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // 1. Converter arquivo para base64
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

      // 2. Fazer upload para o Storage
      const uploadRes = await uploadTemplateFileAction(selectedFile.name, base64Data)
      if ('error' in uploadRes) {
        setErrorMsg(`Erro de upload: ${uploadRes.error}`)
        setIsLoading(false)
        return
      }

      const storagePath = uploadRes.storagePath!

      // 3. Salvar no Banco
      const result = await createContractTemplateAction(
        templateName,
        category,
        storagePath,
        detectedVariables
      )

      if (typeof result === 'string') {
        setErrorMsg(result)
      } else {
        setSuccessMsg('Modelo e variáveis cadastrados com sucesso!')
        setTemplateName('')
        setSelectedFile(null)
        setDetectedVariables([])
        setActiveTab('list')
        loadTemplates()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro durante o cadastro.')
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
                onClick={() => { setActiveTab('list'); setErrorMsg(''); setSuccessMsg('') }}
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
                onClick={() => { setActiveTab('upload'); setErrorMsg(''); setSuccessMsg('') }}
                style={{
                  padding: '12px 6px',
                  color: activeTab === 'upload' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'upload' ? '2px solid var(--accent-color)' : '2px solid transparent',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                Subir Novo DOCX
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
                    border: selectedFile ? '1px solid rgba(0, 229, 155, 0.3)' : '1px dashed rgba(255,255,255,0.15)',
                    background: selectedFile ? 'rgba(0, 229, 155, 0.02)' : 'rgba(255,255,255,0.01)',
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
                  <Upload size={32} style={{ color: selectedFile ? 'var(--success-color)' : 'var(--text-muted)', marginBottom: '12px' }} />
                  {selectedFile ? (
                    <div>
                      <p style={{ color: 'white', fontWeight: 600, margin: '0 0 4px 0', fontSize: '14px' }}>Arquivo carregado com sucesso!</p>
                      <p style={{ color: 'var(--success-color)', fontSize: '12px', margin: 0, fontWeight: 500 }}>{selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</p>
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
                                    <option value="db_tenant_email">Inquilino: E-mail</option>
                                    <option value="db_tenant_phone">Inquilino: Telefone</option>
                                  </optgroup>
                                  <optgroup label="Dados do Imóvel">
                                    <option value="db_property_name">Imóvel: Identificação</option>
                                    <option value="db_property_address">Imóvel: Endereço completo</option>
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
                    onClick={() => setActiveTab('list')}
                    style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !selectedFile}
                    style={{
                      padding: '14px 28px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'var(--success-bg)',
                      color: 'var(--success-color)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: (isLoading || !selectedFile) ? 0.3 : 1,
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

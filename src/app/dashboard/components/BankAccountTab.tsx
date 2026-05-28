'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Plus, Trash2, Star, Check,
  AlertTriangle, Loader2, Landmark, QrCode, X, HelpCircle
} from 'lucide-react'
import {
  getBankAccountsAction,
  createBankAccountAction,
  deleteBankAccountAction,
  toggleMainBankAccountAction,
  type BankAccount
} from '../actions-bank'

interface Props {
  ownerType: 'tenant' | 'landlord'
  ownerId: string
}

const BANK_LIST = [
  { code: '341', name: 'Itaú Unibanco S.A.' },
  { code: '237', name: 'Banco Bradesco S.A.' },
  { code: '001', name: 'Banco do Brasil S.A.' },
  { code: '104', name: 'Caixa Econômica Federal' },
  { code: '033', name: 'Banco Santander (Brasil) S.A.' },
  { code: '260', name: 'Nu Pagamentos S.A. (Nubank)' },
  { code: '077', name: 'Banco Inter S.A.' },
  { code: '336', name: 'Banco C6 S.A.' },
  { code: '290', name: 'PagSeguro Internet S.A. (PagBank)' },
  { code: '748', name: 'Banco Cooperativo Sicredi S.A.' },
  { code: '756', name: 'Banco Cooperativo do Brasil S.A. (Sicoob)' },
  { code: '655', name: 'Banco Votorantim S.A. (Neon)' },
  { code: 'other', name: 'Outro Banco (Digitar manualmente)' },
]

function formatDoc(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d.replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

export default function BankAccountTab({ ownerType, ownerId }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [selectedBank, setSelectedBank] = useState('341')
  const [customBankCode, setCustomBankCode] = useState('')
  const [customBankName, setCustomBankName] = useState('')
  const [branch, setBranch] = useState('')
  const [branchDigit, setBranchDigit] = useState('')
  const [account, setAccount] = useState('')
  const [accountDigit, setAccountDigit] = useState('')
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'payment'>('checking')
  const [holderName, setHolderName] = useState('')
  const [holderDocument, setHolderDocument] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState<string>('')
  const [isMainAccount, setIsMainAccount] = useState(false)
  const [isMainPix, setIsMainPix] = useState(false)
  const [notes, setNotes] = useState('')

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    const res = await getBankAccountsAction(ownerType, ownerId)
    setLoading(false)
    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setAccounts(res.data || [])
    }
  }, [ownerType, ownerId])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Auto preencher dados bancários com base na seleção
  const handleBankChange = (code: string) => {
    setSelectedBank(code)
    if (code !== 'other') {
      const b = BANK_LIST.find(x => x.code === code)
      setCustomBankCode(code)
      setCustomBankName(b?.name || '')
    } else {
      setCustomBankCode('')
      setCustomBankName('')
    }
  }

  // Preencher Itaú como padrão ao montar formulário
  useEffect(() => {
    if (showAddForm && selectedBank !== 'other') {
      handleBankChange(selectedBank)
    }
  }, [showAddForm])

  // Formatar chave pix de acordo com o tipo
  const handlePixKeyChange = (val: string) => {
    if (pixKeyType === 'cpf' || pixKeyType === 'cnpj') {
      setPixKey(formatDoc(val))
    } else if (pixKeyType === 'phone') {
      setPixKey(formatPhone(val))
    } else {
      setPixKey(val)
    }
  }

  const resetForm = () => {
    setSelectedBank('341')
    setCustomBankCode('341')
    setCustomBankName('Itaú Unibanco S.A.')
    setBranch('')
    setBranchDigit('')
    setAccount('')
    setAccountDigit('')
    setAccountType('checking')
    setHolderName('')
    setHolderDocument('')
    setPixKey('')
    setPixKeyType('')
    setIsMainAccount(false)
    setIsMainPix(false)
    setNotes('')
    setShowAddForm(false)
  }

  async function handleAddAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')

    const fd = new FormData()
    fd.append('owner_type', ownerType)
    fd.append('owner_id', ownerId)
    fd.append('bank_name', customBankName.trim())
    fd.append('bank_code', customBankCode.trim())
    fd.append('branch', branch.trim())
    fd.append('branch_digit', branchDigit.trim())
    fd.append('account', account.trim())
    fd.append('account_digit', accountDigit.trim())
    fd.append('account_type', accountType)
    fd.append('holder_name', holderName.trim())
    fd.append('holder_document', holderDocument.replace(/\D/g, ''))
    fd.append('pix_key', pixKey.trim())
    fd.append('pix_key_type', pixKeyType)
    fd.append('is_main_account', isMainAccount ? 'true' : 'false')
    fd.append('is_main_pix', isMainPix ? 'true' : 'false')
    fd.append('notes', notes.trim())

    const err = await createBankAccountAction(fd)
    setSubmitting(false)
    if (err) {
      setErrorMsg(err)
    } else {
      resetForm()
      fetchAccounts()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta conta bancária?')) return
    setActionLoadingId(id)
    setErrorMsg('')
    const err = await deleteBankAccountAction(id)
    setActionLoadingId(null)
    if (err) {
      setErrorMsg(err)
    } else {
      fetchAccounts()
    }
  }

  async function handleToggleMain(id: string, type: 'account' | 'pix') {
    setActionLoadingId(id)
    setErrorMsg('')
    const err = await toggleMainBankAccountAction(id, type)
    setActionLoadingId(null)
    if (err) {
      setErrorMsg(err)
    } else {
      fetchAccounts()
    }
  }

  // Estilos inline de luxo
  const badgeMain: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
    color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em',
    display: 'inline-flex', alignItems: 'center', gap: '4px'
  }
  const badgePix: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
    background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
    color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em',
    display: 'inline-flex', alignItems: 'center', gap: '4px'
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '10px 12px', borderRadius: '8px', color: 'white', outline: 'none',
    width: '100%', boxSizing: 'border-box', fontSize: '13px'
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500
  }

  return (
    <div style={{ marginTop: '10px' }}>
      {/* Mensagem de Erro */}
      {errorMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
          background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.25)',
          borderRadius: '12px', color: '#ffaaaa', fontSize: '13px', marginBottom: '20px'
        }}>
          <AlertTriangle size={16} color="var(--danger-color)" style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Listagem */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Loader2 size={32} className="animate-spin" color="var(--accent-color)" />
        </div>
      ) : accounts.length === 0 && !showAddForm ? (
        <div style={{
          border: '2px dashed rgba(255,255,255,0.08)', borderRadius: '16px',
          padding: '40px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.1)'
        }}>
          <CreditCard size={36} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p style={{ color: 'white', fontWeight: 600, fontSize: '15px', margin: '0 0 4px' }}>Nenhum dado bancário cadastrado</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px' }}>
            Cadastre contas para recebimento de aluguel ou devolução de cauções.
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: 'none',
              background: 'var(--accent-gradient)', color: 'white', fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px'
            }}
          >
            <Plus size={16} /> Adicionar Conta
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Botão de Adicionar quando há lista */}
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              style={{
                alignSelf: 'flex-end', padding: '8px 16px', borderRadius: '8px',
                border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)',
                color: 'var(--accent-color)', fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px'
              }}
            >
              <Plus size={14} /> Adicionar Conta
            </button>
          )}

          {/* Cards de Contas */}
          {!showAddForm && accounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '20px 24px', display: 'flex', gap: '20px',
                position: 'relative', overflow: 'hidden'
              }}
            >
              {/* Indicador lateral sutil de Principal */}
              {acc.is_main_account && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--accent-color)' }} />
              )}

              {/* Ícone */}
              <div style={{
                width: '46px', height: '46px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Landmark size={20} color="var(--text-secondary)" />
              </div>

              {/* Conteúdo */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Cabeçalho Card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: 'white', fontSize: '15px' }}>{acc.bank_name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Cód. {acc.bank_code}
                  </span>
                  {acc.is_main_account && (
                    <span style={badgeMain}><Star size={10} fill="var(--accent-color)" /> Principal</span>
                  )}
                  {acc.is_main_pix && (
                    <span style={badgePix}><QrCode size={10} /> PIX Principal</span>
                  )}
                </div>

                {/* Grid Detalhes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6 }}>Dados Bancários</span>
                    <strong style={{ color: 'var(--text-secondary)' }}>
                      Ag. {acc.branch}{acc.branch_digit ? `-${acc.branch_digit}` : ''} · C/C {acc.account}{acc.account_digit ? `-${acc.account_digit}` : ''}
                    </strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      Tipo: {acc.account_type === 'checking' ? 'Corrente' : acc.account_type === 'savings' ? 'Poupança' : 'Conta de Pagamento'}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6 }}>Favorecido</span>
                    <strong style={{ color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.holder_name}</strong>
                    <span>{formatDoc(acc.holder_document)}</span>
                  </div>
                </div>

                {/* Chave PIX se houver */}
                {acc.pix_key && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <QrCode size={13} /> PIX ({acc.pix_key_type?.toUpperCase()}):
                    </span>
                    <span style={{ color: 'white', fontFamily: 'monospace' }}>{acc.pix_key}</span>
                  </div>
                )}

                {/* Notas se houver */}
                {acc.notes && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    obs: {acc.notes}
                  </div>
                )}
              </div>

              {/* Botões Ação Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.04)', paddingLeft: '16px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleToggleMain(acc.id, 'account')}
                  disabled={actionLoadingId === acc.id}
                  title={acc.is_main_account ? 'Remover como Principal' : 'Definir como Principal'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px',
                    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
                    background: acc.is_main_account ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color: acc.is_main_account ? 'var(--accent-color)' : 'var(--text-muted)',
                    cursor: 'pointer', transition: '0.2s'
                  }}
                >
                  <Star size={14} fill={acc.is_main_account ? 'var(--accent-color)' : 'none'} />
                </button>

                {acc.pix_key && (
                  <button
                    type="button"
                    onClick={() => handleToggleMain(acc.id, 'pix')}
                    disabled={actionLoadingId === acc.id}
                    title={acc.is_main_pix ? 'Remover PIX Principal' : 'Definir PIX Principal'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px',
                      borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
                      background: acc.is_main_pix ? 'rgba(52,211,153,0.1)' : 'transparent',
                      color: acc.is_main_pix ? '#34d399' : 'var(--text-muted)',
                      cursor: 'pointer', transition: '0.2s'
                    }}
                  >
                    <QrCode size={14} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(acc.id)}
                  disabled={actionLoadingId === acc.id}
                  title="Excluir"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px',
                    borderRadius: '8px', border: '1px solid rgba(255,80,80,0.15)',
                    background: 'transparent', color: 'var(--danger-color)',
                    cursor: 'pointer', transition: '0.2s'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de Adicionar (Inline com efeito expansível) */}
      {showAddForm && (
        <form onSubmit={handleAddAccount} style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
            <span style={{ fontWeight: 600, color: 'white', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="var(--accent-color)" /> Nova Conta Bancária
            </span>
            <button type="button" onClick={resetForm} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          {/* Dados Gerais do Banco */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Banco <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select
                value={selectedBank}
                onChange={e => handleBankChange(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                {BANK_LIST.map(b => (
                  <option key={b.code} value={b.code}>{b.name} {b.code !== 'other' ? `(${b.code})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Código do Banco <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                required
                value={customBankCode}
                onChange={e => setCustomBankCode(e.target.value.replace(/\D/g, ''))}
                disabled={selectedBank !== 'other'}
                placeholder="Ex: 341"
                style={inputStyle}
              />
            </div>
          </div>

          {selectedBank === 'other' && (
            <div>
              <label style={labelStyle}>Nome do Banco <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                required
                value={customBankName}
                onChange={e => setCustomBankName(e.target.value)}
                placeholder="Nome da Instituição Financeira"
                style={inputStyle}
              />
            </div>
          )}

          {/* Agência e Conta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr 60px', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Agência <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                required
                value={branch}
                onChange={e => setBranch(e.target.value.replace(/\D/g, ''))}
                placeholder="0001"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Dígito Ag.</label>
              <input
                value={branchDigit}
                onChange={e => setBranchDigit(e.target.value)}
                placeholder="0"
                style={inputStyle}
                maxLength={2}
              />
            </div>
            <div>
              <label style={labelStyle}>Conta <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                required
                value={account}
                onChange={e => setAccount(e.target.value.replace(/\D/g, ''))}
                placeholder="12345"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Dígito Conta</label>
              <input
                value={accountDigit}
                onChange={e => setAccountDigit(e.target.value)}
                placeholder="0"
                style={inputStyle}
                maxLength={2}
              />
            </div>
          </div>

          {/* Tipo de conta */}
          <div>
            <label style={labelStyle}>Tipo de Conta <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {([
                { val: 'checking', lbl: 'Corrente' },
                { val: 'savings', lbl: 'Poupança' },
                { val: 'payment', lbl: 'Pagamento' }
              ] as const).map(t => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setAccountType(t.val)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                    background: accountType === t.val ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${accountType === t.val ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: accountType === t.val ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontWeight: accountType === t.val ? 600 : 400
                  }}
                >
                  {t.lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Dados do Favorecido */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Favorecido <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                required
                value={holderName}
                onChange={e => setHolderName(e.target.value)}
                placeholder="Nome completo do titular"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>CPF/CNPJ Favorecido <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                required
                value={holderDocument}
                onChange={e => setHolderDocument(formatDoc(e.target.value))}
                placeholder="000.000.000-00"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Dados de PIX (Opcional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
            <div>
              <label style={labelStyle}>Tipo Chave PIX</label>
              <select
                value={pixKeyType}
                onChange={e => { setPixKeyType(e.target.value); setPixKey('') }}
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                <option value="">Nenhum (Sem PIX)</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave Aleatória</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Chave PIX</label>
              <input
                value={pixKey}
                disabled={!pixKeyType}
                onChange={e => handlePixKeyChange(e.target.value)}
                placeholder={
                  pixKeyType === 'cpf' ? '000.000.000-00' :
                  pixKeyType === 'cnpj' ? '00.000.000/0000-00' :
                  pixKeyType === 'phone' ? '(11) 99999-9999' :
                  pixKeyType === 'email' ? 'voce@email.com' :
                  pixKeyType === 'random' ? 'Chave EVP aleatória' :
                  'Selecione o tipo de chave primeiro'
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* Checkboxes de Principal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '4px' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '10px 14px', borderRadius: '10px', background: isMainAccount ? 'rgba(99,102,241,0.08)' : 'rgba(0,0,0,0.15)',
              border: `1px solid ${isMainAccount ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`, fontSize: '12px'
            }}>
              <input
                type="checkbox"
                checked={isMainAccount}
                onChange={e => setIsMainAccount(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: isMainAccount ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 600 }}>
                Definir como Conta Principal
              </span>
            </label>

            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: pixKey ? 'pointer' : 'not-allowed',
              padding: '10px 14px', borderRadius: '10px', background: isMainPix ? 'rgba(52,211,153,0.08)' : 'rgba(0,0,0,0.15)',
              border: `1px solid ${isMainPix ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)'}`, fontSize: '12px',
              opacity: pixKey ? 1 : 0.5
            }}>
              <input
                type="checkbox"
                checked={isMainPix}
                disabled={!pixKey}
                onChange={e => setIsMainPix(e.target.checked)}
                style={{ cursor: pixKey ? 'pointer' : 'not-allowed' }}
              />
              <span style={{ color: isMainPix ? '#34d399' : 'var(--text-secondary)', fontWeight: 600 }}>
                Definir como PIX Principal
              </span>
            </label>
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Instruções de repasse ou notas internas"
              style={inputStyle}
            />
          </div>

          {/* Botões Ação Formulário */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              style={{ padding: '10px 20px', borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: 'var(--accent-gradient)', color: 'white', fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? 'Salvando...' : 'Salvar Conta'}
            </button>
          </div>
        </form>
      )}

      {/* Estilos e Keyframes de animação */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

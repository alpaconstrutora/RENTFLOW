'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

interface PrintBtnProps {
  downloadUrl?: string | null
  isTemplate?: boolean
}

export default function PrintBtn({ downloadUrl, isTemplate }: PrintBtnProps) {
  const params = useParams()
  const leaseId = params.leaseId as string
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (isTemplate && downloadUrl) {
      // Inicia download direto do DOCX oficial preenchido
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `contrato-${leaseId.split('-')[0]}.docx`
      a.click()
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/pdf/contrato/${leaseId}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contrato-${leaseId.split('-')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      style={{
        background: 'var(--accent-color)', color: 'white',
        border: 'none', padding: '10px 24px', borderRadius: '8px',
        cursor: loading ? 'wait' : 'pointer', fontWeight: 600, fontSize: '14px',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {isTemplate ? 'Baixar Contrato (DOCX)' : (loading ? 'Gerando PDF...' : 'Baixar PDF')}
    </button>
  )
}


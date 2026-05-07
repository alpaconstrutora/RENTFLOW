'use client'

import { useState } from 'react'
import { FileDown, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ReportActions({ selectedYear, currentYear }: { selectedYear: number, currentYear: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const years = []
  for (let y = currentYear; y >= 2010; y--) years.push(y)

  async function handleExportPDF() {
    setLoading(true)
    try {
      const res = await fetch(`/api/pdf/relatorio?ano=${selectedYear}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dre-${selectedYear}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Calendar size={14} color="var(--text-muted)" style={{ marginRight: '8px' }} />
        <select
          value={selectedYear}
          onChange={e => router.push(`?ano=${e.target.value}`)}
          style={{
            padding: '10px 0', background: 'transparent', border: 'none',
            color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer',
            appearance: 'none', minWidth: '80px'
          }}
        >
          {years.map(y => <option key={y} value={y} style={{ color: 'black' }}>Ano: {y}</option>)}
        </select>
      </div>

      <button
        onClick={handleExportPDF}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '10px 16px', borderRadius: '10px',
          background: 'var(--accent-color)', border: 'none',
          color: 'white', cursor: loading ? 'wait' : 'pointer',
          fontSize: '13px', fontWeight: 600,
          opacity: loading ? 0.7 : 1,
        }}
      >
        <FileDown size={14} />
        {loading ? 'Gerando PDF...' : 'Exportar PDF'}
      </button>
    </div>
  )
}

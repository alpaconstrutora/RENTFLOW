'use client'

import { Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function YearFilter({ selectedYear, currentYear }: { selectedYear: number, currentYear: number }) {
  const router = useRouter()
  
  const years = []
  for (let y = currentYear; y >= 2010; y--) {
    years.push(y)
  }

  return (
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
  )
}

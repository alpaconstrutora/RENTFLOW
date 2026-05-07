'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface Props { mes: string; currentMes: string }

export default function MonthNav({ mes, currentMes }: Props) {
  const router = useRouter()
  const [y, m] = mes.split('-').map(Number)
  const [cy, cm] = currentMes.split('-').map(Number)

  const fmt = (year: number, month: number) =>
    `${year}-${String(month).padStart(2, '0')}`

  const prevMes = m === 1 ? fmt(y - 1, 12) : fmt(y, m - 1)
  const nextMes = m === 12 ? fmt(y + 1, 1) : fmt(y, m + 1)
  const isPrev  = y < 2010 || (y === 2010 && m === 1)
  const isNext  = y > cy || (y === cy && m >= cm)

  const navigate = (year: number, month: number) =>
    router.push(`/dashboard/impostos/carne-leao/${fmt(year, month)}`)

  // Anos disponíveis: 2020 até o ano corrente
  const years: number[] = []
  for (let yr = 2010; yr <= cy; yr++) years.push(yr)

  const sel: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    color: 'white',
    padding: '7px 10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none' as React.CSSProperties['appearance'],
    WebkitAppearance: 'none' as React.CSSProperties['WebkitAppearance'],
    textAlign: 'center' as React.CSSProperties['textAlign'],
    colorScheme: 'dark' as React.CSSProperties['colorScheme'],
  }

  const btn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'white',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={() => !isPrev && router.push(`/dashboard/impostos/carne-leao/${prevMes}`)}
        disabled={isPrev}
        style={{ ...btn, color: isPrev ? 'var(--text-muted)' : 'white', cursor: isPrev ? 'not-allowed' : 'pointer' }}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Seletor de mês */}
      <select
        value={m}
        onChange={e => navigate(y, parseInt(e.target.value))}
        style={{ ...sel, minWidth: '110px' }}
      >
        {MONTHS.map((name, idx) => {
          const monthNum = idx + 1
          const disabled = y === cy && monthNum > cm
          return (
            <option key={monthNum} value={monthNum} disabled={disabled} style={{ background: '#1a1c2e', color: disabled ? '#555' : 'white' }}>
              {name}
            </option>
          )
        })}
      </select>

      {/* Seletor de ano */}
      <select
        value={y}
        onChange={e => navigate(parseInt(e.target.value), m)}
        style={{ ...sel, minWidth: '74px' }}
      >
        {years.map(yr => (
          <option key={yr} value={yr} style={{ background: '#1a1c2e', color: 'white' }}>{yr}</option>
        ))}
      </select>

      <button
        onClick={() => !isNext && router.push(`/dashboard/impostos/carne-leao/${nextMes}`)}
        disabled={isNext}
        style={{ ...btn, color: isNext ? 'var(--text-muted)' : 'white', cursor: isNext ? 'not-allowed' : 'pointer' }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

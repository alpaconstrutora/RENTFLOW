import Holidays from 'date-holidays'

const FISCAL_TIMEZONE = 'America/Sao_Paulo'

let _holidays: Holidays | null = null
function holidays(): Holidays {
  if (!_holidays) _holidays = new Holidays('BR')
  return _holidays
}

function toFiscalDate(date: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: FISCAL_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const y = Number(parts.find(p => p.type === 'year')!.value)
  const m = Number(parts.find(p => p.type === 'month')!.value)
  const d = Number(parts.find(p => p.type === 'day')!.value)
  return { y, m, d }
}

export function fiscalDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

export function lastDayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return fiscalDate(year, month, lastDay)
}

// Feriados "optional" da lib date-holidays que, na prática bancária e fiscal
// brasileira, são tratados como dia não-útil para vencimento de tributos federais.
// Natal-noite (14h) e Véspera de Ano Novo (14h) NÃO entram — são meio-períodos
// e a Receita trata o dia inteiro como útil.
const FISCAL_OPTIONAL_HOLIDAYS = new Set(['Carnaval', 'Corpo de Deus'])

function isBankHoliday(date: Date): boolean {
  const { y, m, d } = toFiscalDate(date)
  const local = new Date(y, m - 1, d, 12, 0, 0)
  const found = holidays().isHoliday(local)
  if (!found) return false
  const list = Array.isArray(found) ? found : [found]
  return list.some(h => {
    if (h.type === 'public' || h.type === 'bank') return true
    if (h.type === 'optional') return FISCAL_OPTIONAL_HOLIDAYS.has(h.name)
    return false
  })
}

export function isBusinessDay(date: Date): boolean {
  const { y, m, d } = toFiscalDate(date)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (dow === 0 || dow === 6) return false
  return !isBankHoliday(date)
}

export function previousBusinessDay(date: Date): Date {
  let { y, m, d } = toFiscalDate(date)
  let cursor = fiscalDate(y, m, d)
  while (!isBusinessDay(cursor)) {
    const prev = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
    const parts = toFiscalDate(prev)
    cursor = fiscalDate(parts.y, parts.m, parts.d)
  }
  return cursor
}

export function lastBusinessDayOfMonth(year: number, month: number): Date {
  return previousBusinessDay(lastDayOfMonth(year, month))
}

export function formatBR(date: Date): string {
  const { y, m, d } = toFiscalDate(date)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

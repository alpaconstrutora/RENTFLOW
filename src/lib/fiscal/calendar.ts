import {
  fiscalDate,
  previousBusinessDay,
  lastBusinessDayOfMonth,
  formatBR,
} from './business-day'
import {
  PIS_COFINS_DUE_DAY,
  IRRF_DUE_DAY,
} from './rules'

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

function parseCompetencia(competencia: string): { y: number; m: number } {
  const [y, m] = competencia.split('-').map(Number)
  if (!y || !m) throw new Error(`Competência inválida: ${competencia}`)
  return { y, m }
}

function nextMonth(y: number, m: number): { y: number; m: number } {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
}

// PIS / COFINS — apuração mensal, vence dia 25 do mês subsequente
// Antecipa para dia útil anterior se cair em fim de semana ou feriado.
export function vencimentoPisCofins(competencia: string): Date {
  const { y, m } = parseCompetencia(competencia)
  const next = nextMonth(y, m)
  return previousBusinessDay(fiscalDate(next.y, next.m, PIS_COFINS_DUE_DAY))
}

// IRRF aluguel (DARF 3208) — apuração mensal, vence dia 20 do mês subsequente
// (regra operacional do 2º decêndio). Antecipa para dia útil anterior.
export function vencimentoIRRF(competencia: string): Date {
  const { y, m } = parseCompetencia(competencia)
  const next = nextMonth(y, m)
  return previousBusinessDay(fiscalDate(next.y, next.m, IRRF_DUE_DAY))
}

// Carnê-Leão — apuração mensal PF, vence no último dia útil do mês subsequente
export function vencimentoCarneLeao(competencia: string): Date {
  const { y, m } = parseCompetencia(competencia)
  const next = nextMonth(y, m)
  return lastBusinessDayOfMonth(next.y, next.m)
}

export function quarterOfMonth(month: number): Quarter {
  if (month <= 3) return 'Q1'
  if (month <= 6) return 'Q2'
  if (month <= 9) return 'Q3'
  return 'Q4'
}

export function quarterEndMonth(quarter: Quarter): number {
  return { Q1: 3, Q2: 6, Q3: 9, Q4: 12 }[quarter]
}

export function quarterMonths(year: number, quarter: Quarter): string[] {
  const end = quarterEndMonth(quarter)
  return [end - 2, end - 1, end].map(m => `${year}-${String(m).padStart(2, '0')}`)
}

// IRPJ / CSLL no Lucro Presumido — apuração trimestral, vence no último
// dia útil do mês subsequente ao encerramento do trimestre.
//
// Exemplo: Q1/2025 (jan-mar) → vence 30/04/2025 (último dia útil de abril)
//          Q4/2025 (out-dez) → vence 30/01/2026 (31/01 é sábado → antecipa)
export function vencimentoTrimestral(year: number, quarter: Quarter): Date {
  const endMonth = quarterEndMonth(quarter)
  const next = nextMonth(year, endMonth)
  return lastBusinessDayOfMonth(next.y, next.m)
}

export { formatBR }

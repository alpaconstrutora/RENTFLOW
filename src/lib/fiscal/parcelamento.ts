// Parcelamento de IRPJ e CSLL — Lucro Presumido
// Base legal: Lei 9.430/96, art. 5°
//
// Regras:
// - Até 3 quotas mensais iguais (antes dos juros)
// - Quota mínima R$ 1.000 — total abaixo desse valor não é parcelável
// - 1ª quota: sem acréscimo
// - 2ª quota: base × 1% (Selic 0 meses completos + 1% no mês do pagamento)
// - 3ª quota: base × (selicMensal + 1%) (Selic 1 mês + 1% no mês do pagamento)
//
// Fundamento do cálculo de Selic:
// "calculados a partir do primeiro dia do mês subsequente ao do vencimento
//  da primeira quota até o último dia do mês anterior ao do pagamento,
//  mais 1% no mês do pagamento" (art. 5°, §1°)
//
// Para 2ª quota (vence 1 mês após a 1ª): 0 meses completos de Selic + 1%
// Para 3ª quota (vence 2 meses após a 1ª): 1 mês de Selic + 1%

import { vencimentoTrimestral, formatBR, type Quarter } from './calendar'
import { lastBusinessDayOfMonth } from './business-day'

export const QUOTA_MINIMA = 1000

export interface QuotaResult {
  numero: 1 | 2 | 3
  base: number
  juros: number
  total: number
  due: string    // DD/MM/YYYY
  dueDate: Date
}

export interface ParcelamentoResult {
  parcelavel: boolean
  motivo?: string
  quotas: QuotaResult[]
  totalComJuros: number
  selicMensalUsada: number  // taxa mensal usada no cálculo (informativo)
  selicAnualUsada: number
}

function nextMonthBusinessDay(year: number, month: number) {
  const nextM = month === 12 ? 1 : month + 1
  const nextY = month === 12 ? year + 1 : year
  return { date: lastBusinessDayOfMonth(nextY, nextM), y: nextY, m: nextM }
}

function splitBase(total: number, n: 2 | 3): [number, number] {
  // Retorna [baseComum, baseÚltima] — a última absorve resíduo de arredondamento
  const comum = Math.floor((total / n) * 100) / 100
  const ultima = Math.round((total - comum * (n - 1)) * 100) / 100
  return [comum, ultima]
}

export function calcParcelamento(
  totalTributo: number,
  year: number,
  quarter: Quarter,
  nQuotas: 2 | 3,
  selicMensal: number,
  selicAnual: number,
): ParcelamentoResult {
  if (totalTributo < QUOTA_MINIMA) {
    return {
      parcelavel: false,
      motivo: `Total inferior a R$ ${QUOTA_MINIMA.toLocaleString('pt-BR')} — parcelamento não permitido (Lei 9.430/96, art. 5°, §1°).`,
      quotas: [],
      totalComJuros: totalTributo,
      selicMensalUsada: selicMensal,
      selicAnualUsada: selicAnual,
    }
  }

  const due1 = vencimentoTrimestral(year, quarter)
  const y1 = due1.getUTCFullYear()
  const m1 = due1.getUTCMonth() + 1
  const { date: due2, y: y2, m: m2 } = nextMonthBusinessDay(y1, m1)
  const { date: due3 } = nextMonthBusinessDay(y2, m2)

  const [baseComum, baseUltima] = splitBase(totalTributo, nQuotas)

  const quotas: QuotaResult[] = []

  if (nQuotas === 2) {
    // 1ª quota: sem juros
    quotas.push({ numero: 1, base: baseComum, juros: 0, total: baseComum, due: formatBR(due1), dueDate: due1 })
    // 2ª quota: 1% no mês do pagamento (0 meses Selic acumulada)
    const juros2 = baseUltima * 0.01
    quotas.push({ numero: 2, base: baseUltima, juros: juros2, total: baseUltima + juros2, due: formatBR(due2), dueDate: due2 })
  } else {
    // 1ª quota: sem juros
    quotas.push({ numero: 1, base: baseComum, juros: 0, total: baseComum, due: formatBR(due1), dueDate: due1 })
    // 2ª quota: 1% (0 meses Selic + 1%)
    const juros2 = baseComum * 0.01
    quotas.push({ numero: 2, base: baseComum, juros: juros2, total: baseComum + juros2, due: formatBR(due2), dueDate: due2 })
    // 3ª quota: selicMensal × 1 + 1%
    const juros3 = baseUltima * (selicMensal + 0.01)
    quotas.push({ numero: 3, base: baseUltima, juros: juros3, total: baseUltima + juros3, due: formatBR(due3), dueDate: due3 })
  }

  return {
    parcelavel: true,
    quotas,
    totalComJuros: quotas.reduce((s, q) => s + q.total, 0),
    selicMensalUsada: selicMensal,
    selicAnualUsada: selicAnual,
  }
}

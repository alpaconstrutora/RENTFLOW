// Simulador PF vs PJ — Lucro Presumido
// Compara carga tributária anual entre pessoa física (Carnê-Leão IRPF)
// e pessoa jurídica (PIS + COFINS + CSLL + IRPJ Lucro Presumido).
//
// Todas as funções são puras — não acessam banco de dados.
// Brackets devem ser passados como parâmetro (vindos do DB via Server Component).
//
// Nota: não contempla IRPJ adicional (10% sobre base > R$60k/trimestre, i.e.,
// receita bruta acima de ~R$62.500/mês). Para perfis acima desse patamar,
// a vantagem PJ indicada aqui é subestimada.

import {
  PIS_RATE_DEFAULT,
  COFINS_RATE_DEFAULT,
  CSLL_RATE_DEFAULT,
  IRPJ_RATE_DEFAULT,
} from './rules'

export interface IrpfBracket {
  min_income: number
  max_income: number | null
  rate: number
  deduction: number
}

export interface SimuladorPJRates {
  pisRate?: number
  cofinsRate?: number
  csllRate?: number
  irpjRate?: number
}

export interface SimuladorPFResult {
  baseMensal: number
  tributoMensal: number
  tributoAnual: number
  aliquotaEfetiva: number   // tributoMensal / baseMensal (0 se isento)
  faixa: IrpfBracket | null
}

export interface SimuladorPJResult {
  pisAnual: number
  cofinsAnual: number
  csllAnual: number
  irpjAnual: number
  totalTributosAnual: number
  custoOperacionalAnual: number
  totalBurdenAnual: number
  aliquotaEfetivaTributos: number   // totalTributosAnual / receitaAnual
  aliquotaEfetivaBurden: number     // totalBurdenAnual / receitaAnual
}

export interface BreakevenResult {
  encontrado: boolean
  receitaMensalBreakeven: number | null
  nota: string
}

export function findApplicableBracket(
  baseMensal: number,
  brackets: IrpfBracket[],
): IrpfBracket | null {
  return (
    brackets.find(
      b =>
        baseMensal >= b.min_income &&
        (b.max_income === null || baseMensal <= b.max_income),
    ) ?? null
  )
}

export function calcSimuladorPF(
  receitaMensal: number,
  deducoesMensais: number,
  brackets: IrpfBracket[],
): SimuladorPFResult {
  const baseMensal = Math.max(0, receitaMensal - deducoesMensais)
  const faixa = findApplicableBracket(baseMensal, brackets)
  const tributoMensal =
    faixa && faixa.rate > 0
      ? Math.max(0, baseMensal * faixa.rate - faixa.deduction)
      : 0
  const tributoAnual = tributoMensal * 12
  const aliquotaEfetiva = baseMensal > 0 ? tributoMensal / baseMensal : 0
  return { baseMensal, tributoMensal, tributoAnual, aliquotaEfetiva, faixa }
}

export function calcSimuladorPJ(
  receitaMensal: number,
  custoOperacionalMensal: number,
  rates: SimuladorPJRates = {},
): SimuladorPJResult {
  const pisRate    = rates.pisRate    ?? PIS_RATE_DEFAULT
  const cofinsRate = rates.cofinsRate ?? COFINS_RATE_DEFAULT
  const csllRate   = rates.csllRate   ?? CSLL_RATE_DEFAULT
  const irpjRate   = rates.irpjRate   ?? IRPJ_RATE_DEFAULT

  const receitaAnual = receitaMensal * 12
  const pisAnual    = receitaAnual * pisRate
  const cofinsAnual = receitaAnual * cofinsRate
  const csllAnual   = receitaAnual * csllRate
  const irpjAnual   = receitaAnual * irpjRate

  const totalTributosAnual   = pisAnual + cofinsAnual + csllAnual + irpjAnual
  const custoOperacionalAnual = custoOperacionalMensal * 12
  const totalBurdenAnual     = totalTributosAnual + custoOperacionalAnual

  const aliquotaEfetivaTributos =
    receitaAnual > 0 ? totalTributosAnual / receitaAnual : 0
  const aliquotaEfetivaBurden =
    receitaAnual > 0 ? totalBurdenAnual / receitaAnual : 0

  return {
    pisAnual,
    cofinsAnual,
    csllAnual,
    irpjAnual,
    totalTributosAnual,
    custoOperacionalAnual,
    totalBurdenAnual,
    aliquotaEfetivaTributos,
    aliquotaEfetivaBurden,
  }
}

// Busca binária: receita mensal onde a carga PF ≈ carga PJ (+ custos operacionais).
// Abaixo do ponto de equilíbrio → PF é mais vantajoso.
// Acima → PJ (Lucro Presumido) é mais vantajoso.
export function findBreakeven(
  deducoesMensais: number,
  custoOperacionalMensal: number,
  brackets: IrpfBracket[],
  rates: SimuladorPJRates = {},
): BreakevenResult {
  const MAX_RECEITA = 150_000

  const pfBurden = (r: number) =>
    calcSimuladorPF(r, deducoesMensais, brackets).tributoAnual
  const pjBurden = (r: number) =>
    calcSimuladorPJ(r, custoOperacionalMensal, rates).totalBurdenAnual

  // diff < 0 → PF mais barato | diff > 0 → PJ mais barato
  const diff = (r: number) => pfBurden(r) - pjBurden(r)

  const dLow = diff(1)              // receita próxima de zero
  const dHigh = diff(MAX_RECEITA)

  if (dLow >= 0 && dHigh >= 0) {
    return {
      encontrado: false,
      receitaMensalBreakeven: null,
      nota: 'Lucro Presumido é vantajoso em toda a faixa simulada.',
    }
  }

  if (dLow < 0 && dHigh < 0) {
    return {
      encontrado: false,
      receitaMensalBreakeven: null,
      nota: 'Carnê-Leão PF é vantajoso em toda a faixa simulada.',
    }
  }

  // Busca binária — 50 iterações dão precisão < R$ 1 centavo em [1, 150k]
  let lo = 1, hi = MAX_RECEITA
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (diff(mid) < 0) lo = mid
    else hi = mid
    if (hi - lo < 0.01) break
  }

  return {
    encontrado: true,
    receitaMensalBreakeven: Math.round((lo + hi) / 2),
    nota:
      'Acima desta receita mensal, Lucro Presumido tende a ter menor carga em tributos.',
  }
}

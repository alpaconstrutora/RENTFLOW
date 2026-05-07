import { FISCAL_RULESET_VERSION, LAST_RULE_REVIEW } from './rules'

export type FiscalRegime = 'lucro_presumido' | 'carneleao' | 'irrf'

export interface FiscalDisclaimerOptions {
  regime: FiscalRegime
  includesIRRF?: boolean
  includesDARF?: boolean
  includesBusinessDayCalc?: boolean
}

export interface FiscalDisclaimerContent {
  title: string
  lines: string[]
  rulesetVersion: string
  lastReview: string
  lastReviewFormatted: string
}

const REGIME_LABELS: Record<FiscalRegime, string> = {
  lucro_presumido: 'Lucro Presumido (PJ)',
  carneleao: 'Carnê-Leão IRPF (PF)',
  irrf: 'IRRF Aluguel',
}

function formatReviewDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function getFiscalDisclaimer(opts: FiscalDisclaimerOptions): FiscalDisclaimerContent {
  const lines: string[] = [
    `Valores estimados para o regime de ${REGIME_LABELS[opts.regime]}.`,
    'Não substitui orientação de contador ou tributarista habilitado.',
    'Cálculo baseado nas receitas registradas no sistema — divergências em lançamentos afetam diretamente o resultado.',
  ]

  if (opts.regime === 'lucro_presumido') {
    lines.push(
      'Base de presunção de 32% aplicada sobre receita bruta de aluguel (Lei 9.249/95, art. 15).',
      'Cobre apenas IRPJ, CSLL, PIS e COFINS — não inclui ISS, INSS ou outras obrigações acessórias.'
    )
  }

  if (opts.regime === 'carneleao') {
    lines.push(
      'Apuração pelo regime de caixa: considera a data efetiva de recebimento, não o mês de competência.',
      'Carnê-Leão não se aplica quando há retenção na fonte por PJ locatária (IRRF cód. 3208).'
    )
  }

  if (opts.includesIRRF) {
    lines.push('IRRF retido na fonte (cód. 3208) é de responsabilidade da PJ pagadora — verifique a guia DARF emitida pela locatária.')
  }

  if (opts.includesDARF) {
    lines.push('Este sistema não emite DARF oficial — utilize o SICALC da Receita Federal para geração do documento de arrecadação.')
  }

  if (opts.includesBusinessDayCalc) {
    lines.push('Datas de vencimento calculadas com feriados bancários nacionais vigentes. Feriados estaduais e municipais não são considerados.')
  }

  lines.push(`Regras fiscais revisadas em ${formatReviewDate(LAST_RULE_REVIEW)} · Conjunto de regras v${FISCAL_RULESET_VERSION}.`)

  return {
    title: `Estimativa — ${REGIME_LABELS[opts.regime]}`,
    lines,
    rulesetVersion: FISCAL_RULESET_VERSION,
    lastReview: LAST_RULE_REVIEW,
    lastReviewFormatted: formatReviewDate(LAST_RULE_REVIEW),
  }
}

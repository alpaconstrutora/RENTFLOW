// Identifica a versão do conjunto de regras tributárias aplicado.
// Salvar este valor junto com cada cálculo persistido (auditabilidade).
export const FISCAL_RULESET_VERSION = '2025.2'

// Data da última revisão técnica das regras fiscais. Exibida no app
// (transparência ao usuário, redução de risco de expectativa implícita).
export const LAST_RULE_REVIEW = '2026-05-06'

// Dia de vencimento de cada tributo (antes da regra de antecipação).
// Quando cair em fim de semana ou feriado bancário, antecipa-se para
// o dia útil anterior conforme regra geral dos tributos federais.
export const PIS_COFINS_DUE_DAY = 25
export const IRRF_DUE_DAY       = 20  // 2º decêndio do mês subsequente (cód. 3208)

// IRRF — código DARF para aluguel pago por PJ a PF
export const IRRF_DARF_CODE = '3208'

// Lucro Presumido — base de presunção para receita de aluguel (Lei 9.249/95, art. 15)
export const PRESUMED_BASE_FACTOR_DEFAULT = 0.32

// Alíquotas-padrão (podem ser sobrescritas por pj_tax_config do usuário)
export const PIS_RATE_DEFAULT    = 0.0065
export const COFINS_RATE_DEFAULT = 0.030
export const CSLL_RATE_DEFAULT   = 0.0288  // 9% × 32%
export const IRPJ_RATE_DEFAULT   = 0.048   // 15% × 32%

// IRPJ Adicional — Lei 9.430/96, art. 3º
// Base presumida trimestral acima de R$60.000 paga +10% sobre o excedente.
export const IRPJ_BASE_RATE                  = 0.15
export const IRPJ_ADICIONAL_RATE             = 0.10
export const IRPJ_ADICIONAL_THRESHOLD_QUARTER = 60_000

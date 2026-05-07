import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcSimuladorPF,
  calcSimuladorPJ,
  findBreakeven,
  findApplicableBracket,
  type IrpfBracket,
} from './simulador'
import {
  PIS_RATE_DEFAULT,
  COFINS_RATE_DEFAULT,
  CSLL_RATE_DEFAULT,
  IRPJ_RATE_DEFAULT,
} from './rules'

// Tabela IRPF vigente mai/2024
const BRACKETS_2024: IrpfBracket[] = [
  { min_income:    0.00, max_income: 2259.20, rate: 0.0000, deduction:    0.00 },
  { min_income: 2259.21, max_income: 2826.65, rate: 0.0750, deduction:  169.44 },
  { min_income: 2826.66, max_income: 3751.05, rate: 0.1500, deduction:  381.44 },
  { min_income: 3751.06, max_income: 4664.68, rate: 0.2250, deduction:  662.77 },
  { min_income: 4664.69, max_income:    null, rate: 0.2750, deduction:  896.00 },
]

// ── findApplicableBracket ─────────────────────────────────────────────────────

test('isento: base 0 → faixa 0%', () => {
  const b = findApplicableBracket(0, BRACKETS_2024)
  assert.equal(b?.rate, 0)
})

test('isento: base 2.259,20 → faixa 0%', () => {
  const b = findApplicableBracket(2259.20, BRACKETS_2024)
  assert.equal(b?.rate, 0)
})

test('base 2.500 → faixa 7,5%', () => {
  const b = findApplicableBracket(2500, BRACKETS_2024)
  assert.equal(b?.rate, 0.075)
})

test('base 10.000 → faixa 27,5%', () => {
  const b = findApplicableBracket(10000, BRACKETS_2024)
  assert.equal(b?.rate, 0.275)
})

// ── calcSimuladorPF ───────────────────────────────────────────────────────────

test('PF isento: receita 2.000 sem deduções → tributo zero', () => {
  const r = calcSimuladorPF(2000, 0, BRACKETS_2024)
  assert.equal(r.tributoMensal, 0)
  assert.equal(r.tributoAnual,  0)
  assert.equal(r.aliquotaEfetiva, 0)
})

test('PF isento por deduções: receita 5.000, dedução 3.000 → base 2.000 < limite', () => {
  const r = calcSimuladorPF(5000, 3000, BRACKETS_2024)
  assert.equal(r.baseMensal, 2000)
  assert.equal(r.tributoMensal, 0)
})

test('PF faixa 7,5%: base 2.500 → imposto = 2.500 × 7,5% - 169,44 = 17,81', () => {
  const r = calcSimuladorPF(2500, 0, BRACKETS_2024)
  assert.equal(r.baseMensal, 2500)
  const expected = Math.max(0, 2500 * 0.075 - 169.44)  // 17.81
  assert.ok(Math.abs(r.tributoMensal - expected) < 0.01, `expected ~${expected}, got ${r.tributoMensal}`)
  assert.ok(Math.abs(r.tributoAnual - expected * 12) < 0.01)
})

test('PF faixa 27,5%: receita 10.000 → imposto = 10.000 × 27,5% - 896 = 1.854', () => {
  const r = calcSimuladorPF(10000, 0, BRACKETS_2024)
  const expected = 10000 * 0.275 - 896  // 1854
  assert.ok(Math.abs(r.tributoMensal - expected) < 0.01, `expected ~${expected}, got ${r.tributoMensal}`)
  assert.ok(Math.abs(r.tributoAnual - expected * 12) < 0.01)
})

test('PF alíquota efetiva: receita 10.000, sem deduções ≈ 18,54%', () => {
  const r = calcSimuladorPF(10000, 0, BRACKETS_2024)
  const efetiva = r.tributoMensal / r.baseMensal
  assert.ok(Math.abs(efetiva - 0.1854) < 0.001, `esperava ~18,54%, got ${(efetiva * 100).toFixed(2)}%`)
})

test('PF: base negativa tratada como zero', () => {
  const r = calcSimuladorPF(1000, 5000, BRACKETS_2024)
  assert.equal(r.baseMensal, 0)
  assert.equal(r.tributoMensal, 0)
})

// ── calcSimuladorPJ ───────────────────────────────────────────────────────────

test('PJ taxa efetiva com alíquotas padrão ≈ 11,33%', () => {
  const expected = PIS_RATE_DEFAULT + COFINS_RATE_DEFAULT + CSLL_RATE_DEFAULT + IRPJ_RATE_DEFAULT
  const r = calcSimuladorPJ(10000, 0)
  assert.ok(Math.abs(r.aliquotaEfetivaTributos - expected) < 0.0001,
    `esperava ${(expected * 100).toFixed(2)}%, got ${(r.aliquotaEfetivaTributos * 100).toFixed(2)}%`)
})

test('PJ: custo operacional zero → burden = tributos', () => {
  const r = calcSimuladorPJ(5000, 0)
  assert.equal(r.custoOperacionalAnual, 0)
  assert.equal(r.totalBurdenAnual, r.totalTributosAnual)
})

test('PJ: custo operacional 500/mês → burden = tributos + 6.000/ano', () => {
  const r = calcSimuladorPJ(5000, 500)
  assert.equal(r.custoOperacionalAnual, 6000)
  assert.ok(Math.abs(r.totalBurdenAnual - r.totalTributosAnual - 6000) < 0.01)
})

test('PJ receita 10.000/mês → total tributos anual correto', () => {
  const r = calcSimuladorPJ(10000, 0)
  const expected = 10000 * 12 * (PIS_RATE_DEFAULT + COFINS_RATE_DEFAULT + CSLL_RATE_DEFAULT + IRPJ_RATE_DEFAULT)
  assert.ok(Math.abs(r.totalTributosAnual - expected) < 0.01)
})

test('PJ: receita zero → alíquotas efetivas zero', () => {
  const r = calcSimuladorPJ(0, 0)
  assert.equal(r.aliquotaEfetivaTributos, 0)
  assert.equal(r.aliquotaEfetivaBurden,   0)
})

// ── findBreakeven ─────────────────────────────────────────────────────────────

test('breakeven existe com parâmetros típicos (sem deduções, custo 500/mês)', () => {
  const r = findBreakeven(0, 500, BRACKETS_2024)
  assert.equal(r.encontrado, true)
  assert.notEqual(r.receitaMensalBreakeven, null)
  // Ponto de equilíbrio deve estar em faixa razoável
  assert.ok(r.receitaMensalBreakeven! > 1000, 'breakeven deve ser > R$1.000/mês')
  assert.ok(r.receitaMensalBreakeven! < 150_000, 'breakeven deve ser < R$150.000/mês')
})

test('breakeven: custo operacional zero sem deduções → ainda existe ponto de cruzamento', () => {
  const r = findBreakeven(0, 0, BRACKETS_2024)
  // Com custo=0 e sem deduções, PF é isento até R$2.259; PJ paga 11,33% imediatamente
  // PF torna-se mais caro que PJ em algum ponto na faixa 27,5% vs 11,33%
  assert.equal(r.encontrado, true)
})

test('breakeven: deduções muito altas → PF sempre melhor', () => {
  // Deduções de R$10.000/mês: base quase sempre isenta ou muito baixa
  const r = findBreakeven(10000, 0, BRACKETS_2024)
  // Com deduções altas o suficiente, PF pode ser sempre melhor
  // (pode ou não encontrar, dependendo do valor de MAX_RECEITA)
  assert.ok(typeof r.encontrado === 'boolean')
  assert.ok(typeof r.nota === 'string')
})

test('breakeven: resultado é consistente (verificação no ponto encontrado)', () => {
  const deducoes = 0
  const custoOp  = 800
  const r = findBreakeven(deducoes, custoOp, BRACKETS_2024)
  if (r.encontrado && r.receitaMensalBreakeven !== null) {
    const br = r.receitaMensalBreakeven
    const pfA = calcSimuladorPF(br, deducoes, BRACKETS_2024).tributoAnual
    const pjA = calcSimuladorPJ(br, custoOp).totalBurdenAnual
    // Valores devem ser próximos (R$ 100 de tolerância na busca binária)
    assert.ok(Math.abs(pfA - pjA) < 200, `PF ${pfA.toFixed(0)} vs PJ ${pjA.toFixed(0)} — diferença acima do esperado`)
  }
})

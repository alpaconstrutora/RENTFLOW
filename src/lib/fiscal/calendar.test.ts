import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  vencimentoPisCofins,
  vencimentoIRRF,
  vencimentoCarneLeao,
  vencimentoTrimestral,
  quarterOfMonth,
} from './calendar.js'
import { formatBR } from './business-day.js'

describe('vencimentoPisCofins (dia 25 do mês seguinte, antecipa)', () => {
  test('competência 04/2025 → 25/05/2025 é domingo → 23/05/2025', () => {
    assert.equal(formatBR(vencimentoPisCofins('2025-04')), '23/05/2025')
  })

  test('competência 06/2025 → 25/07/2025 é sexta útil', () => {
    assert.equal(formatBR(vencimentoPisCofins('2025-06')), '25/07/2025')
  })

  test('competência 12/2025 → 25/01/2026 é domingo → 23/01/2026', () => {
    assert.equal(formatBR(vencimentoPisCofins('2025-12')), '23/01/2026')
  })
})

describe('vencimentoIRRF (dia 20 do mês seguinte, antecipa)', () => {
  test('competência 03/2025 → 20/04/2025 é domingo → 17/04/2025 (18 é Sexta Santa)', () => {
    assert.equal(formatBR(vencimentoIRRF('2025-03')), '17/04/2025')
  })

  test('competência 04/2025 → 20/05/2025 é terça útil', () => {
    assert.equal(formatBR(vencimentoIRRF('2025-04')), '20/05/2025')
  })

  test('competência 11/2025 → 20/12/2025 é sábado → 19/12/2025', () => {
    assert.equal(formatBR(vencimentoIRRF('2025-11')), '19/12/2025')
  })
})

describe('vencimentoCarneLeao (último dia útil do mês seguinte)', () => {
  test('competência 03/2025 → último dia útil de abril/2025 = 30/04', () => {
    assert.equal(formatBR(vencimentoCarneLeao('2025-03')), '30/04/2025')
  })

  test('competência 12/2025 → último dia útil de janeiro/2026 = 30/01 (31 é sábado)', () => {
    assert.equal(formatBR(vencimentoCarneLeao('2025-12')), '30/01/2026')
  })
})

describe('vencimentoTrimestral (CSLL/IRPJ — último dia útil pós-trimestre)', () => {
  test('Q1/2025 → 30/04/2025', () => {
    assert.equal(formatBR(vencimentoTrimestral(2025, 'Q1')), '30/04/2025')
  })

  test('Q2/2025 → 31/07/2025', () => {
    assert.equal(formatBR(vencimentoTrimestral(2025, 'Q2')), '31/07/2025')
  })

  test('Q3/2025 → 31/10/2025', () => {
    assert.equal(formatBR(vencimentoTrimestral(2025, 'Q3')), '31/10/2025')
  })

  test('Q4/2025 → 30/01/2026 (31 é sábado, antecipa) — REGRESSÃO PERMANENTE', () => {
    assert.equal(formatBR(vencimentoTrimestral(2025, 'Q4')), '30/01/2026')
  })
})

describe('quarterOfMonth', () => {
  test('janeiro = Q1', () => assert.equal(quarterOfMonth(1), 'Q1'))
  test('março = Q1',  () => assert.equal(quarterOfMonth(3), 'Q1'))
  test('abril = Q2',  () => assert.equal(quarterOfMonth(4), 'Q2'))
  test('junho = Q2',  () => assert.equal(quarterOfMonth(6), 'Q2'))
  test('julho = Q3',  () => assert.equal(quarterOfMonth(7), 'Q3'))
  test('outubro = Q4',() => assert.equal(quarterOfMonth(10), 'Q4'))
  test('dezembro = Q4',() => assert.equal(quarterOfMonth(12), 'Q4'))
})

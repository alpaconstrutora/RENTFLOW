import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { calcParcelamento, QUOTA_MINIMA } from './parcelamento.js'
import { anualParaMensal } from './selic.js'

const SELIC_AA   = 0.1475            // 14.75% a.a. (referência de teste)
const SELIC_MM   = anualParaMensal(SELIC_AA)  // ~1.15% a.m.

describe('calcParcelamento — não parcelável', () => {
  test('total < R$ 1.000 retorna parcelavel=false', () => {
    const r = calcParcelamento(999.99, 2025, 'Q1', 2, SELIC_MM, SELIC_AA)
    assert.equal(r.parcelavel, false)
    assert.ok(r.motivo?.includes('inferior'))
    assert.equal(r.quotas.length, 0)
  })

  test('total exatamente R$ 1.000 retorna parcelavel=true', () => {
    const r = calcParcelamento(QUOTA_MINIMA, 2025, 'Q1', 2, SELIC_MM, SELIC_AA)
    assert.equal(r.parcelavel, true)
  })
})

describe('calcParcelamento — 2 quotas (Q1/2025 → 1ª vence 30/04)', () => {
  const total = 5000
  const r = calcParcelamento(total, 2025, 'Q1', 2, SELIC_MM, SELIC_AA)

  test('retorna 2 quotas', () => assert.equal(r.quotas.length, 2))

  test('1ª quota: sem juros, vence 30/04/2025', () => {
    const q1 = r.quotas[0]
    assert.equal(q1.numero, 1)
    assert.equal(q1.juros, 0)
    assert.equal(q1.due, '30/04/2025')
  })

  test('2ª quota: 1% de juros, vence último dia útil de maio/2025', () => {
    const q2 = r.quotas[1]
    assert.equal(q2.numero, 2)
    const jurosEsperado = q2.base * 0.01
    assert.ok(Math.abs(q2.juros - jurosEsperado) < 0.01, `juros=${q2.juros} esperado≈${jurosEsperado}`)
    assert.equal(q2.due, '30/05/2025')
  })

  test('soma das bases = total original', () => {
    const somaBase = r.quotas.reduce((s, q) => s + q.base, 0)
    assert.ok(Math.abs(somaBase - total) <= 0.01)
  })

  test('totalComJuros > total original', () => {
    assert.ok(r.totalComJuros > total)
  })
})

describe('calcParcelamento — 3 quotas (Q1/2025 → 1ª vence 30/04)', () => {
  const total = 6000
  const r = calcParcelamento(total, 2025, 'Q1', 3, SELIC_MM, SELIC_AA)

  test('retorna 3 quotas', () => assert.equal(r.quotas.length, 3))

  test('1ª quota: sem juros, vence 30/04/2025', () => {
    const q1 = r.quotas[0]
    assert.equal(q1.juros, 0)
    assert.equal(q1.due, '30/04/2025')
  })

  test('2ª quota: 1% de juros, vence 30/05/2025', () => {
    const q2 = r.quotas[1]
    const jurosEsperado = q2.base * 0.01
    assert.ok(Math.abs(q2.juros - jurosEsperado) < 0.01)
    assert.equal(q2.due, '30/05/2025')
  })

  test('3ª quota: selicMensal+1% de juros, vence 30/06/2025', () => {
    const q3 = r.quotas[2]
    const jurosEsperado = q3.base * (SELIC_MM + 0.01)
    assert.ok(Math.abs(q3.juros - jurosEsperado) < 0.01)
    assert.equal(q3.due, '30/06/2025')
  })

  test('juros da 3ª > juros da 2ª (Selic acumulada)', () => {
    assert.ok(r.quotas[2].juros > r.quotas[1].juros)
  })

  test('soma das bases = total original', () => {
    const somaBase = r.quotas.reduce((s, q) => s + q.base, 0)
    assert.ok(Math.abs(somaBase - total) <= 0.01)
  })
})

describe('calcParcelamento — Q4/2025 (vence 30/01/2026 — regressão)', () => {
  test('1ª quota vence 30/01/2026 (31/01 é sábado)', () => {
    const r = calcParcelamento(3000, 2025, 'Q4', 2, SELIC_MM, SELIC_AA)
    assert.equal(r.quotas[0].due, '30/01/2026')
  })

  test('2ª quota vence último dia útil de fevereiro/2026', () => {
    const r = calcParcelamento(3000, 2025, 'Q4', 2, SELIC_MM, SELIC_AA)
    assert.equal(r.quotas[1].due, '27/02/2026') // 28/02/2026 é sábado
  })
})

describe('anualParaMensal', () => {
  test('14.75% a.a. → ~1.15% a.m.', () => {
    const mensal = anualParaMensal(0.1475)
    assert.ok(mensal > 0.011 && mensal < 0.012, `mensal=${mensal}`)
  })

  test('idempotência: (1+mm)^12 ≈ 1+aa', () => {
    const aa = 0.1475
    const mm = anualParaMensal(aa)
    const recomposto = Math.pow(1 + mm, 12) - 1
    assert.ok(Math.abs(recomposto - aa) < 0.0001)
  })
})

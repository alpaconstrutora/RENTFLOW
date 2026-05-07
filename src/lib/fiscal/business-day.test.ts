import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isBusinessDay,
  previousBusinessDay,
  lastBusinessDayOfMonth,
  fiscalDate,
  formatBR,
} from './business-day.js'

describe('isBusinessDay', () => {
  test('segunda-feira útil retorna true', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 5, 5)), true)
  })

  test('sábado retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 5, 3)), false)
  })

  test('domingo retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 5, 4)), false)
  })

  test('Confraternização Universal (01/01) retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 1, 1)), false)
  })

  test('Tiradentes (21/04) retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 4, 21)), false)
  })

  test('Independência (07/09/2025, domingo) retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 9, 7)), false)
  })

  test('Carnaval 2025 (terça 04/03/2025) retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 3, 4)), false)
  })

  test('Sexta-feira Santa 2025 (18/04/2025) retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 4, 18)), false)
  })

  test('Corpus Christi 2025 (19/06/2025) retorna false', () => {
    assert.equal(isBusinessDay(fiscalDate(2025, 6, 19)), false)
  })
})

describe('previousBusinessDay', () => {
  test('sábado 31/01/2026 antecipa para sexta 30/01/2026 (caso de regressão)', () => {
    const result = previousBusinessDay(fiscalDate(2026, 1, 31))
    assert.equal(formatBR(result), '30/01/2026')
  })

  test('domingo 04/05/2025 antecipa para sexta 02/05/2025', () => {
    const result = previousBusinessDay(fiscalDate(2025, 5, 4))
    assert.equal(formatBR(result), '02/05/2025')
  })

  test('dia útil retorna o próprio dia', () => {
    const result = previousBusinessDay(fiscalDate(2025, 5, 5))
    assert.equal(formatBR(result), '05/05/2025')
  })

  test('feriado em quarta retorna terça anterior', () => {
    const result = previousBusinessDay(fiscalDate(2025, 1, 1))
    assert.equal(formatBR(result), '31/12/2024')
  })
})

describe('lastBusinessDayOfMonth', () => {
  test('janeiro 2026 (último dia 31 = sábado) retorna 30/01/2026', () => {
    assert.equal(formatBR(lastBusinessDayOfMonth(2026, 1)), '30/01/2026')
  })

  test('abril 2025 (último dia 30 = quarta) retorna 30/04/2025', () => {
    assert.equal(formatBR(lastBusinessDayOfMonth(2025, 4)), '30/04/2025')
  })

  test('julho 2025 (último dia 31 = quinta) retorna 31/07/2025', () => {
    assert.equal(formatBR(lastBusinessDayOfMonth(2025, 7)), '31/07/2025')
  })

  test('outubro 2025 (último dia 31 = sexta) retorna 31/10/2025', () => {
    assert.equal(formatBR(lastBusinessDayOfMonth(2025, 10)), '31/10/2025')
  })

  test('fevereiro bissexto 2024 (último dia 29 = quinta) retorna 29/02/2024', () => {
    assert.equal(formatBR(lastBusinessDayOfMonth(2024, 2)), '29/02/2024')
  })

  test('fevereiro 2025 (último dia 28 = sexta) retorna 28/02/2025', () => {
    assert.equal(formatBR(lastBusinessDayOfMonth(2025, 2)), '28/02/2025')
  })

  test('dezembro 2025 (31 = quarta, mas Natal é feriado) retorna 31/12/2025', () => {
    assert.equal(formatBR(lastBusinessDayOfMonth(2025, 12)), '31/12/2025')
  })
})

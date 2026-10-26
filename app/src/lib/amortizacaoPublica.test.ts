import { describe, expect, it } from 'vitest'
import { addMonthsToDateInput, formatDateInput, taxaMensalFromInput } from './amortizacaoPublica'

describe('amortização pública', () => {
  it('converte taxa anual efetiva para mensal', () => {
    expect(taxaMensalFromInput(12, 'anual')).toBeCloseTo(0.00948879, 8)
  })

  it('preserva viradas de mês e ano no cronograma', () => {
    expect(addMonthsToDateInput('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDateInput('2026-12-15', 1)).toBe('2027-01-15')
    expect(formatDateInput('2027-01-15')).toBe('15/01/2027')
  })
})

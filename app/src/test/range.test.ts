import { describe, expect, it } from 'vitest'

import { clampInteger, parseRangeInteger } from '@/lib/range'

describe('range helpers', () => {
  it('aplica clamp e inteiro para limites válidos', () => {
    expect(clampInteger(11.9, 12, 240)).toBe(12)
    expect(clampInteger(120.8, 12, 240)).toBe(120)
    expect(clampInteger(241, 12, 240)).toBe(240)
  })

  it('usa fallback normalizado quando valor do evento é inválido', () => {
    expect(parseRangeInteger('', 118, 12, 240)).toBe(118)
    expect(parseRangeInteger('abc', 500, 12, 240)).toBe(240)
  })

  it('normaliza carência dentro da faixa 0..3', () => {
    expect(parseRangeInteger('-1', 0, 0, 3)).toBe(0)
    expect(parseRangeInteger('2.9', 0, 0, 3)).toBe(2)
    expect(parseRangeInteger('4', 0, 0, 3)).toBe(3)
  })
})

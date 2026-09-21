import { describe, expect, it } from 'vitest'
import { formatReais, parseReaisInput } from '@/components/MoneyInput'
import { brl } from '@/lib/utils'

describe('formatação monetária brasileira', () => {
  it('exibe reais com milhar e duas casas decimais', () => {
    expect(formatReais(40_000).replace(/\s/g, ' ')).toBe('R$ 40.000,00')
    expect(brl(4_000_000).replace(/\s/g, ' ')).toBe('R$ 40.000,00')
  })

  it('converte o valor mascarado de volta para número', () => {
    expect(parseReaisInput('R$ 40.000,00')).toBe(40_000)
  })
})

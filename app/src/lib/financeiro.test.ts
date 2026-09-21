import { describe, expect, it } from 'vitest'
import { calcularCondicaoComercial, compactNumber, localDateISO } from './financeiro'

describe('calcularCondicaoComercial', () => {
  it('calcula receita bruta de 6% e parceiro sobre a receita', () => {
    expect(calcularCondicaoComercial({
      valorBase: 2_000_000,
      percentualReceita: 6,
      baseComissaoParceiro: 'receita_bruta',
      percentualParceiro: 10,
    })).toEqual({ receitaBruta: 120_000, baseParceiro: 120_000, comissaoParceiro: 12_000, margemPreliminar: 108_000 })
  })

  it('calcula parceiro sobre o valor liberado sem alterar receita Mercurio', () => {
    expect(calcularCondicaoComercial({
      valorBase: 2_000_000,
      percentualReceita: 6,
      baseComissaoParceiro: 'valor_liberado',
      percentualParceiro: 1.5,
    })).toEqual({ receitaBruta: 120_000, baseParceiro: 2_000_000, comissaoParceiro: 30_000, margemPreliminar: 90_000 })
  })
})

describe('localDateISO', () => {
  it('nao converte a data local para o dia UTC anterior ou seguinte', () => {
    expect(localDateISO(new Date(2026, 8, 2, 0, 5))).toBe('2026-09-02')
  })
})

describe('compactNumber', () => {
  it.each([
    [999, '999'],
    [1_000, '1 K'],
    [10_000, '10 K'],
    [100_000, '100 K'],
    [1_000_000, '1 M'],
    [1_250_000, '1,3 M'],
  ])('formata %i como %s', (value, expected) => {
    expect(compactNumber(value)).toBe(expected)
  })
})

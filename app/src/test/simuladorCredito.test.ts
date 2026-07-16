import { beforeEach, describe, expect, it } from 'vitest'
import { formatReais, parseReaisInput } from '@/components/MoneyInput'
import { calcularSimulacao } from '@/components/SimuladorCredito'
import { consumeSimulacaoDraft, saveSimulacaoDraft } from '@/lib/simulacaoDraft'

const draft = {
  produto: 'home_equity' as const,
  pessoa_tipo: 'PF' as const,
  valor_solicitado: 300_000,
  valor_garantia: 850_000,
  taxa_juros_mensal: 1.29,
  prazo_meses: 120,
  carencia_meses: 0,
  correcao: 'pos_fixado' as const,
  amortizacao: 'price' as const,
}

describe('simulador de crédito', () => {
  beforeEach(() => sessionStorage.clear())

  it('formata e converte moeda brasileira mantendo reais no estado', () => {
    expect(formatReais(350_000)).toBe('R$ 350.000,00')
    expect(parseReaisInput('R$ 350.000,00')).toBe(350_000)
    expect(parseReaisInput('')).toBe(0)
  })

  it('calcula resultado e LTV pelo motor compartilhado', () => {
    const result = calcularSimulacao(draft)
    expect(result.ltv).toBeCloseTo(300_000 / 850_000)
    expect(result.calculo.primeiraParcela).toBeGreaterThan(0)
    expect(result.calculo.rendaMinima).toBeGreaterThan(result.calculo.primeiraParcela)
  })

  it('consome o draft uma única vez', () => {
    saveSimulacaoDraft(draft)
    expect(consumeSimulacaoDraft()).toEqual(draft)
    expect(consumeSimulacaoDraft()).toBeNull()
  })
})
import { describe, expect, it } from 'vitest'
import { calcularComparativoAmortizacao, validarPlanosAmortizacao, type PlanoAmortizacaoExtra } from './amortizacaoPlanos'

const input = { valor: 120_000, prazoMeses: 12, taxaMensal: 0.01, amortizacao: 'price' as const }
const plan = (patch: Partial<PlanoAmortizacaoExtra> = {}): PlanoAmortizacaoExtra => ({
  id: 'plan-1', valorExtra: 10_000, objetivo: 'prazo', frequencia: 'unica', aposParcela: 2, ...patch,
})

describe('planos de amortização extra', () => {
  it('mantém o cenário original quando não há plano', () => {
    const result = calcularComparativoAmortizacao(input, [])
    expect(result.comAntecipacao.totalPago).toBeCloseTo(result.semAntecipacao.totalPago, 6)
    expect(result.comAntecipacao.parcelas).toHaveLength(12)
    expect(result.economiaJuros).toBeCloseTo(0, 6)
  })

  it('amortiza uma vez após a parcela escolhida e reduz o prazo', () => {
    const result = calcularComparativoAmortizacao(input, [plan()])
    expect(result.comAntecipacao.parcelas[1].amortizacaoExtra).toBe(10_000)
    expect(result.comAntecipacao.parcelas.length).toBeLessThan(12)
    expect(result.comAntecipacao.totalAmortizacaoExtra).toBe(10_000)
    expect(result.economiaJuros).toBeGreaterThan(0)
  })

  it('recalcula o valor das parcelas restantes quando o objetivo é reduzir parcela', () => {
    const result = calcularComparativoAmortizacao(input, [plan({ objetivo: 'parcela' })])
    expect(result.comAntecipacao.parcelas).toHaveLength(12)
    expect(result.comAntecipacao.parcelas[2].parcela).toBeLessThan(result.comAntecipacao.parcelas[1].parcela)
  })

  it('repete amortização mensal até quitar sem saldo negativo', () => {
    const result = calcularComparativoAmortizacao(input, [plan({ valorExtra: 5_000, frequencia: 'mensal' })])
    expect(result.comAntecipacao.totalAmortizacaoExtra).toBeGreaterThan(5_000)
    expect(result.comAntecipacao.parcelas[result.comAntecipacao.parcelas.length - 1]?.saldo).toBe(0)
    expect(result.comAntecipacao.parcelas.every(row => row.saldo >= 0)).toBe(true)
  })

  it('limita amortização extra ao saldo restante e valida planos antes de salvar', () => {
    const result = calcularComparativoAmortizacao(input, [plan({ valorExtra: 120_000, aposParcela: 12 })])
    expect(result.comAntecipacao.parcelas[result.comAntecipacao.parcelas.length - 1]?.saldo).toBe(0)
    expect(validarPlanosAmortizacao([plan({ valorExtra: 0 })], input.valor, input.prazoMeses)).toContain('maior que zero')
    expect(validarPlanosAmortizacao([plan({ aposParcela: 13 })], input.valor, input.prazoMeses)).toContain('parcela')
  })
})

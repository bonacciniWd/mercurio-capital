import { describe, it, expect } from 'vitest'
import { calcularFinanciamento, calcularLTV } from './credito'

describe('calcularFinanciamento', () => {
  it('Price: parcela constante e soma fecha com valor + juros', () => {
    const r = calcularFinanciamento({
      valor: 100_000,
      prazoMeses: 12,
      taxaMensal: 0.01,
      amortizacao: 'price',
    })
    expect(r.parcelas).toHaveLength(12)
    // Price → parcela constante
    const diffs = r.parcelas.map(p => Math.abs(p.parcela - r.primeiraParcela))
    diffs.forEach(d => expect(d).toBeLessThan(0.01))
    // Saldo zera no final
    expect(r.parcelas[11].saldo).toBeLessThan(0.01)
    // Total pago = soma das parcelas
    expect(Math.abs(r.totalPago - r.parcelas.reduce((s, p) => s + p.parcela, 0))).toBeLessThan(0.01)
    // Juros totais positivos
    expect(r.totalJuros).toBeGreaterThan(0)
  })

  it('Price 100k/12m/1%: PMT ~ 8.884,88', () => {
    const r = calcularFinanciamento({
      valor: 100_000,
      prazoMeses: 12,
      taxaMensal: 0.01,
      amortizacao: 'price',
    })
    expect(r.primeiraParcela).toBeCloseTo(8884.88, 1)
  })

  it('SAC: amortização constante, parcela decrescente', () => {
    const r = calcularFinanciamento({
      valor: 120_000,
      prazoMeses: 12,
      taxaMensal: 0.01,
      amortizacao: 'sac',
    })
    expect(r.parcelas).toHaveLength(12)
    // Amortização constante = 10.000
    r.parcelas.forEach(p => expect(p.amortizacao).toBeCloseTo(10_000, 2))
    // Parcela decrescente
    for (let i = 1; i < r.parcelas.length; i++) {
      expect(r.parcelas[i].parcela).toBeLessThan(r.parcelas[i - 1].parcela)
    }
    expect(r.parcelas[11].saldo).toBeLessThan(0.01)
  })

  it('com carência: meses iniciais sem amortização, saldo cresce', () => {
    const r = calcularFinanciamento({
      valor: 100_000,
      prazoMeses: 14,
      taxaMensal: 0.01,
      amortizacao: 'price',
      carenciaMeses: 2,
    })
    expect(r.parcelas).toHaveLength(14)
    expect(r.parcelas[0].amortizacao).toBe(0)
    expect(r.parcelas[1].amortizacao).toBe(0)
    // Após carência, saldo é > valor original
    expect(r.parcelas[1].saldo).toBeGreaterThan(100_000)
    expect(r.parcelas[2].amortizacao).toBeGreaterThan(0)
  })

  it('taxa zero: PMT = valor/prazo', () => {
    const r = calcularFinanciamento({
      valor: 12_000,
      prazoMeses: 12,
      taxaMensal: 0,
      amortizacao: 'price',
    })
    expect(r.primeiraParcela).toBeCloseTo(1_000, 5)
    expect(r.totalJuros).toBeCloseTo(0, 5)
  })

  it('entradas inválidas retornam zero', () => {
    const r = calcularFinanciamento({
      valor: 0,
      prazoMeses: 12,
      taxaMensal: 0.01,
      amortizacao: 'price',
    })
    expect(r.parcelas).toHaveLength(0)
    expect(r.primeiraParcela).toBe(0)
  })
})

describe('calcularLTV', () => {
  it('LTV = solicitado/imovel', () => {
    expect(calcularLTV(350_000, 850_000)).toBeCloseTo(0.4118, 4)
  })
  it('imóvel zero → 0', () => {
    expect(calcularLTV(100, 0)).toBe(0)
  })
})

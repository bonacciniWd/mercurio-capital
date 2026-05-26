/**
 * Calculadora de crédito — sistemas Price e SAC.
 * Espelho da implementação web em app/src/lib/credito.ts.
 */

export type AmortizacaoTipo = 'price' | 'sac'

export interface CalcInput {
  valor: number
  prazoMeses: number
  taxaMensal: number
  amortizacao: AmortizacaoTipo
  carenciaMeses?: number
}

export interface ParcelaRow {
  mes: number
  juros: number
  amortizacao: number
  parcela: number
  saldo: number
}

export interface CalcResult {
  parcelas: ParcelaRow[]
  primeiraParcela: number
  ultimaParcela: number
  totalPago: number
  totalJuros: number
  rendaMinima: number
}

export function calcularFinanciamento(input: CalcInput): CalcResult {
  const { valor, prazoMeses, taxaMensal, amortizacao, carenciaMeses = 0 } = input
  if (valor <= 0 || prazoMeses <= 0 || taxaMensal < 0) {
    return { parcelas: [], primeiraParcela: 0, ultimaParcela: 0, totalPago: 0, totalJuros: 0, rendaMinima: 0 }
  }

  const parcelas: ParcelaRow[] = []
  let saldo = valor

  for (let m = 1; m <= carenciaMeses; m++) {
    const juros = saldo * taxaMensal
    saldo += juros
    parcelas.push({ mes: m, juros, amortizacao: 0, parcela: juros, saldo })
  }

  const mesesAmortiza = prazoMeses - carenciaMeses
  if (mesesAmortiza <= 0) return finalize(parcelas, valor)

  if (amortizacao === 'price') {
    const i = taxaMensal
    const n = mesesAmortiza
    const pmt = i === 0 ? saldo / n : (saldo * i) / (1 - Math.pow(1 + i, -n))
    for (let k = 1; k <= n; k++) {
      const juros = saldo * i
      const amort = pmt - juros
      saldo = Math.max(0, saldo - amort)
      parcelas.push({ mes: carenciaMeses + k, juros, amortizacao: amort, parcela: pmt, saldo })
    }
  } else {
    const amort = saldo / mesesAmortiza
    for (let k = 1; k <= mesesAmortiza; k++) {
      const juros = saldo * taxaMensal
      const parcela = amort + juros
      saldo = Math.max(0, saldo - amort)
      parcelas.push({ mes: carenciaMeses + k, juros, amortizacao: amort, parcela, saldo })
    }
  }

  return finalize(parcelas, valor)
}

function finalize(parcelas: ParcelaRow[], valorOriginal: number): CalcResult {
  const totalPago = parcelas.reduce((sum, p) => sum + p.parcela, 0)
  const totalJuros = totalPago - valorOriginal
  const primeira = parcelas[0]?.parcela ?? 0
  const ultima = parcelas[parcelas.length - 1]?.parcela ?? 0
  const rendaMinima = primeira / 0.3
  return { parcelas, primeiraParcela: primeira, ultimaParcela: ultima, totalPago, totalJuros, rendaMinima }
}

export function calcularLTV(valorSolicitado: number, valorImovel: number): number {
  if (valorImovel <= 0) return 0
  return valorSolicitado / valorImovel
}


/**
 * Calculadora de crédito — sistemas Price e SAC.
 *
 * Convenções:
 * - Valores monetários em reais (number, NÃO centavos) para facilitar cálculos.
 *   Conversão para centavos só ao persistir.
 * - Taxa de juros em decimal mensal (ex.: 0.0139 = 1,39% a.m.).
 * - Carência: meses iniciais em que NÃO há amortização (só juros somam ao saldo).
 */

export type AmortizacaoTipo = 'price' | 'sac'

export interface CalcInput {
  /** Valor financiado (R$). */
  valor: number
  /** Prazo total em meses, incluindo carência. */
  prazoMeses: number
  /** Taxa de juros mensal em decimal. */
  taxaMensal: number
  /** Sistema de amortização. */
  amortizacao: AmortizacaoTipo
  /** Carência (meses sem amortização). Default 0. */
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
  /** Renda mínima sugerida (parcela = 30% da renda). */
  rendaMinima: number
}

/** Calcula tabela de amortização completa. */
export function calcularFinanciamento(input: CalcInput): CalcResult {
  const { valor, prazoMeses, taxaMensal, amortizacao, carenciaMeses = 0 } = input
  if (valor <= 0 || prazoMeses <= 0 || taxaMensal < 0) {
    return {
      parcelas: [],
      primeiraParcela: 0,
      ultimaParcela: 0,
      totalPago: 0,
      totalJuros: 0,
      rendaMinima: 0,
    }
  }

  const parcelas: ParcelaRow[] = []
  let saldo = valor

  // Carência: só juros, sem amortização. Saldo cresce.
  for (let m = 1; m <= carenciaMeses; m++) {
    const juros = saldo * taxaMensal
    saldo += juros
    parcelas.push({ mes: m, juros, amortizacao: 0, parcela: juros, saldo })
  }

  const mesesAmortiza = prazoMeses - carenciaMeses
  if (mesesAmortiza <= 0) {
    return finalize(parcelas, valor)
  }

  if (amortizacao === 'price') {
    // PMT = PV * i / (1 - (1+i)^-n)
    const i = taxaMensal
    const n = mesesAmortiza
    const pmt = i === 0 ? saldo / n : (saldo * i) / (1 - Math.pow(1 + i, -n))
    for (let k = 1; k <= n; k++) {
      const juros = saldo * i
      const amort = pmt - juros
      saldo = Math.max(0, saldo - amort)
      parcelas.push({
        mes: carenciaMeses + k,
        juros,
        amortizacao: amort,
        parcela: pmt,
        saldo,
      })
    }
  } else {
    // SAC: amortização constante.
    const amort = saldo / mesesAmortiza
    for (let k = 1; k <= mesesAmortiza; k++) {
      const juros = saldo * taxaMensal
      const parcela = amort + juros
      saldo = Math.max(0, saldo - amort)
      parcelas.push({
        mes: carenciaMeses + k,
        juros,
        amortizacao: amort,
        parcela,
        saldo,
      })
    }
  }

  return finalize(parcelas, valor)
}

function finalize(parcelas: ParcelaRow[], valorOriginal: number): CalcResult {
  const totalPago = parcelas.reduce((sum, p) => sum + p.parcela, 0)
  const totalJuros = totalPago - valorOriginal
  const primeira = parcelas[0]?.parcela ?? 0
  const ultima = parcelas[parcelas.length - 1]?.parcela ?? 0
  // Convenção banco: parcela máxima = 30% da renda.
  const rendaMinima = primeira / 0.3
  return {
    parcelas,
    primeiraParcela: primeira,
    ultimaParcela: ultima,
    totalPago,
    totalJuros,
    rendaMinima,
  }
}

/** LTV = valor solicitado / valor da garantia. Retorna fração [0..1+]. */
export function calcularLTV(valorSolicitado: number, valorImovel: number): number {
  if (valorImovel <= 0) return 0
  return valorSolicitado / valorImovel
}

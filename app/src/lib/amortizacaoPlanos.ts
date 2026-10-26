import { calcularFinanciamento, type AmortizacaoTipo, type CalcInput, type CalcResult, type ParcelaRow } from './credito'

export type ObjetivoAmortizacaoExtra = 'prazo' | 'parcela'
export type FrequenciaAmortizacaoExtra = 'unica' | 'mensal'

export interface PlanoAmortizacaoExtra {
  id: string
  valorExtra: number
  objetivo: ObjetivoAmortizacaoExtra
  frequencia: FrequenciaAmortizacaoExtra
  aposParcela: number
}

export interface ParcelaComAmortizacaoExtra extends ParcelaRow {
  amortizacaoExtra: number
  pagamentoTotal: number
}

export interface ResultadoComAmortizacaoExtra extends Omit<CalcResult, 'parcelas'> {
  parcelas: ParcelaComAmortizacaoExtra[]
  totalAmortizacaoExtra: number
}

export interface ComparativoAmortizacao {
  semAntecipacao: CalcResult
  comAntecipacao: ResultadoComAmortizacaoExtra
  economiaJuros: number
  parcelasReduzidas: number
}

export function validarPlanosAmortizacao(planos: PlanoAmortizacaoExtra[], valor: number, prazoMeses: number): string | null {
  if (planos.length > 10) return 'Adicione no máximo 10 planos de amortização.'
  for (const plano of planos) {
    if (!Number.isFinite(plano.valorExtra) || plano.valorExtra <= 0 || plano.valorExtra > valor) {
      return 'Cada plano deve ter um valor maior que zero e não superior ao empréstimo.'
    }
    if (!Number.isInteger(plano.aposParcela) || plano.aposParcela < 1 || plano.aposParcela > prazoMeses) {
      return `Informe em qual parcela (1 a ${prazoMeses}) o plano começa.`
    }
    if (!['prazo', 'parcela'].includes(plano.objetivo) || !['unica', 'mensal'].includes(plano.frequencia)) {
      return 'Revise a frequência e o objetivo de cada plano.'
    }
  }
  return null
}

export function calcularComparativoAmortizacao(input: CalcInput, planos: PlanoAmortizacaoExtra[]): ComparativoAmortizacao {
  const semAntecipacao = calcularFinanciamento(input)
  const planosAtivos = planos.filter(plano => plano.valorExtra > 0)
  const comAntecipacao = calcularComPlanos(input, planosAtivos)
  return {
    semAntecipacao,
    comAntecipacao,
    economiaJuros: semAntecipacao.totalJuros - comAntecipacao.totalJuros,
    parcelasReduzidas: Math.max(0, semAntecipacao.parcelas.length - comAntecipacao.parcelas.length),
  }
}

function calcularComPlanos(input: CalcInput, planos: PlanoAmortizacaoExtra[]): ResultadoComAmortizacaoExtra {
  const base = calcularFinanciamento(input)
  if (base.parcelas.length === 0 || planos.length === 0) {
    return {
      ...base,
      parcelas: base.parcelas.map(row => ({ ...row, amortizacaoExtra: 0, pagamentoTotal: row.parcela })),
      totalAmortizacaoExtra: 0,
    }
  }

  let saldo = input.valor
  let parcelaPrice = base.parcelas[0]?.parcela ?? 0
  let amortizacaoSac = input.valor / input.prazoMeses
  let totalPago = 0
  let totalJuros = 0
  let totalAmortizacaoExtra = 0
  const parcelas: ParcelaComAmortizacaoExtra[] = []

  for (let mes = 1; mes <= input.prazoMeses && saldo > 0.000001; mes += 1) {
    const juros = saldo * input.taxaMensal
    const amortizacao = Math.min(saldo, input.amortizacao === 'price' ? Math.max(0, parcelaPrice - juros) : amortizacaoSac)
    const parcela = juros + amortizacao
    saldo = Math.max(0, saldo - amortizacao)

    const planosDoMes = planos.filter(plano => (
      plano.frequencia === 'unica'
        ? mes === plano.aposParcela
        : mes >= plano.aposParcela
    ))
    let extraSolicitado = 0
    for (const plano of planosDoMes) extraSolicitado += plano.valorExtra
    const amortizacaoExtra = Math.min(saldo, extraSolicitado)
    saldo = Math.max(0, saldo - amortizacaoExtra)
    totalPago += parcela + amortizacaoExtra
    totalJuros += juros
    totalAmortizacaoExtra += amortizacaoExtra

    parcelas.push({
      mes,
      juros,
      amortizacao,
      amortizacaoExtra,
      parcela,
      pagamentoTotal: parcela + amortizacaoExtra,
      saldo,
    })

    if (saldo <= 0.000001) {
      saldo = 0
      break
    }

    if (planosDoMes.some(plano => plano.objetivo === 'parcela')) {
      const mesesRestantes = input.prazoMeses - mes
      if (mesesRestantes > 0) {
        if (input.amortizacao === 'price') {
          parcelaPrice = input.taxaMensal === 0
            ? saldo / mesesRestantes
            : saldo * input.taxaMensal / (1 - Math.pow(1 + input.taxaMensal, -mesesRestantes))
        } else {
          amortizacaoSac = saldo / mesesRestantes
        }
      }
    }
  }

  const primeiraParcela = parcelas[0]?.parcela ?? 0
  const ultimaParcela = parcelas[parcelas.length - 1]?.parcela ?? 0
  return {
    parcelas,
    primeiraParcela,
    ultimaParcela,
    totalPago,
    totalJuros,
    rendaMinima: primeiraParcela / 0.3,
    totalAmortizacaoExtra,
  }
}

export function plansToApi(planos: PlanoAmortizacaoExtra[]) {
  return planos.map(plano => ({
    valor_extra: plano.valorExtra,
    objetivo: plano.objetivo,
    frequencia: plano.frequencia,
    apos_parcela: plano.aposParcela,
  }))
}

export function summaryToApi(
  input: CalcInput & { dataInicio: string },
  comparativo: ComparativoAmortizacao,
) {
  return {
    sem_antecipacao: {
      total_pago: comparativo.semAntecipacao.totalPago,
      total_juros: Math.max(0, comparativo.semAntecipacao.totalJuros),
      quantidade_parcelas: comparativo.semAntecipacao.parcelas.length,
      primeira_parcela: comparativo.semAntecipacao.primeiraParcela,
      ultima_parcela: comparativo.semAntecipacao.ultimaParcela,
      data_quitacao: addMonthsToDateInput(input.dataInicio, comparativo.semAntecipacao.parcelas.length),
    },
    com_antecipacao: {
      total_pago: comparativo.comAntecipacao.totalPago,
      total_juros: Math.max(0, comparativo.comAntecipacao.totalJuros),
      total_amortizado_extra: comparativo.comAntecipacao.totalAmortizacaoExtra,
      quantidade_parcelas: comparativo.comAntecipacao.parcelas.length,
      primeira_parcela: comparativo.comAntecipacao.primeiraParcela,
      ultima_parcela: comparativo.comAntecipacao.ultimaParcela,
      data_quitacao: addMonthsToDateInput(input.dataInicio, comparativo.comAntecipacao.parcelas.length),
    },
    economia_juros: comparativo.economiaJuros,
    parcelas_reduzidas: comparativo.parcelasReduzidas,
  }
}

function addMonthsToDateInput(value: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const target = new Date(Date.UTC(year, month, 1, 12))
  target.setUTCMonth(target.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`
}

export function amortizacaoTipoLabel(tipo: AmortizacaoTipo): string {
  return tipo === 'sac' ? 'Tabela SAC' : 'Tabela Price'
}

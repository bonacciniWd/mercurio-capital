import type { CalcInput, CalcResult } from '@/lib/credito'

export type ProdutoSimulacao = 'home_equity' | 'credito_construcao' | 'financiamento_imobiliario'
export type PessoaSimulacao = 'PF' | 'PJ'
export type CorrecaoSimulacao = 'pos_fixado' | 'pre_fixado'

export interface PartnerSimulationValues extends CalcInput {
  produto: ProdutoSimulacao
  pessoaTipo: PessoaSimulacao
  valorGarantia: number
  taxaMensalPercentual: number
  correcao: CorrecaoSimulacao
}

export const PARTNER_SIMULATION_DEFAULTS: PartnerSimulationValues = {
  produto: 'home_equity',
  pessoaTipo: 'PF',
  valor: 350_000,
  valorGarantia: 850_000,
  prazoMeses: 120,
  taxaMensalPercentual: 1.29,
  taxaMensal: 0.0129,
  amortizacao: 'price',
  carenciaMeses: 0,
  correcao: 'pos_fixado',
}

export function parseSimulationParams(params: Record<string, string | string[] | undefined>): Partial<PartnerSimulationValues> {
  const text = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }
  const numeric = (key: string, min: number, max: number) => {
    const raw = text(key)
    if (raw === undefined || raw.trim() === '') return undefined
    const value = Number(raw)
    return Number.isFinite(value) && value >= min && value <= max ? value : undefined
  }
  const produto = text('sim_produto')
  const pessoaTipo = text('sim_pessoa_tipo')
  const amortizacao = text('sim_amortizacao')
  const correcao = text('sim_correcao')
  const valor = numeric('sim_valor', 1, 100_000_000)
  const valorGarantia = numeric('sim_garantia', 1, 1_000_000_000)
  const prazoMeses = numeric('sim_prazo', 12, 240)
  const carenciaMeses = numeric('sim_carencia', 0, 3)
  const taxaMensalPercentual = numeric('sim_taxa', 0, 100)

  return {
    ...(produto === 'home_equity' || produto === 'credito_construcao' || produto === 'financiamento_imobiliario' ? { produto } : {}),
    ...(pessoaTipo === 'PF' || pessoaTipo === 'PJ' ? { pessoaTipo } : {}),
    ...(amortizacao === 'price' || amortizacao === 'sac' ? { amortizacao } : {}),
    ...(correcao === 'pos_fixado' || correcao === 'pre_fixado' ? { correcao } : {}),
    ...(valor !== undefined ? { valor } : {}),
    ...(valorGarantia !== undefined ? { valorGarantia } : {}),
    ...(prazoMeses !== undefined ? { prazoMeses } : {}),
    ...(carenciaMeses !== undefined ? { carenciaMeses } : {}),
    ...(taxaMensalPercentual !== undefined ? { taxaMensalPercentual, taxaMensal: taxaMensalPercentual / 100 } : {}),
  }
}

export function simulationShareText(values: PartnerSimulationValues, result: CalcResult, ltv: number): string {
  const brl = (amount: number) => amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const produto = {
    home_equity: 'Home Equity',
    credito_construcao: 'Crédito Construção',
    financiamento_imobiliario: 'Financiamento Imobiliário',
  }[values.produto]
  return [
    'Simulação comercial Mercúrio Capital',
    `Produto: ${produto} (${values.pessoaTipo})`,
    `Crédito: ${brl(values.valor)}`,
    `Garantia: ${brl(values.valorGarantia)}`,
    `LTV: ${(ltv * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
    `Prazo: ${values.prazoMeses} meses · Carência: ${values.carenciaMeses} meses`,
    `Taxa: ${values.taxaMensalPercentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m. · ${values.amortizacao.toUpperCase()}`,
    `1ª parcela: ${brl(result.primeiraParcela)} · Última parcela: ${brl(result.ultimaParcela)}`,
    `Total estimado: ${brl(result.totalPago)} · Renda mínima estimada: ${brl(result.rendaMinima)}/mês`,
    'Prévia sem IOF, TAC, registro e seguros; a variação futura do IPCA não está projetada. Não representa oferta, aprovação ou condição final de crédito.',
  ].join('\n')
}

export type SimuladorParametrosStatus = 'aguardando_validacao_financeira'

export type BaseCalculoCusto = 'credito_liquido' | 'principal_bruto' | 'saldo_devedor' | 'valor_garantia'

export interface FaixaRegistroImovel {
  uf: string
  valor_minimo: number | null
  valor_maximo: number | null
  tarifa: number | null
}

export interface SimuladorParametros {
  schema_version: 1
  versao: number
  status: SimuladorParametrosStatus
  vigente_desde: null
  iof: {
    percentual_adicional: number | null
    percentual_diario: number | null
    limite_dias: number | null
    base: BaseCalculoCusto | null
  }
  tac: {
    percentual: number | null
    minimo_reais: number | null
    base: BaseCalculoCusto | null
  }
  registro: {
    faixas: FaixaRegistroImovel[]
  }
  seguros: {
    mip_percentual_mensal: number | null
    mip_base: BaseCalculoCusto | null
    dfi_percentual_mensal: number | null
    dfi_base: BaseCalculoCusto | null
  }
}

export interface SimuladorParametrosPublicos {
  status: SimuladorParametrosStatus
  versao: number
  vigente_desde: string | null
  taxa_juros_mensal_default: number | null
}

export function simuladorParametrosVazios(versao = 0): SimuladorParametros {
  return {
    schema_version: 1,
    versao,
    status: 'aguardando_validacao_financeira',
    vigente_desde: null,
    iof: {
      percentual_adicional: null,
      percentual_diario: null,
      limite_dias: null,
      base: null,
    },
    tac: {
      percentual: null,
      minimo_reais: null,
      base: null,
    },
    registro: { faixas: [] },
    seguros: {
      mip_percentual_mensal: null,
      mip_base: null,
      dfi_percentual_mensal: null,
      dfi_base: null,
    },
  }
}

export function normalizarSimuladorParametros(value: unknown): SimuladorParametros {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return simuladorParametrosVazios()
  const raw = value as Partial<SimuladorParametros>
  const empty = simuladorParametrosVazios(Number.isInteger(raw.versao) ? Number(raw.versao) : 0)
  const normalizeNumber = (candidate: unknown): number | null => {
    if (candidate === null || candidate === undefined || candidate === '') return null
    const numeric = Number(candidate)
    return Number.isFinite(numeric) ? numeric : null
  }
  const normalizeBase = (candidate: unknown): BaseCalculoCusto | null => (
    candidate === 'credito_liquido' || candidate === 'principal_bruto'
      || candidate === 'saldo_devedor' || candidate === 'valor_garantia'
      ? candidate
      : null
  )
  const faixaRows = Array.isArray(raw.registro?.faixas) ? raw.registro.faixas : []

  return {
    ...empty,
    iof: {
      percentual_adicional: normalizeNumber(raw.iof?.percentual_adicional),
      percentual_diario: normalizeNumber(raw.iof?.percentual_diario),
      limite_dias: normalizeNumber(raw.iof?.limite_dias),
      base: normalizeBase(raw.iof?.base),
    },
    tac: {
      percentual: normalizeNumber(raw.tac?.percentual),
      minimo_reais: normalizeNumber(raw.tac?.minimo_reais),
      base: normalizeBase(raw.tac?.base),
    },
    registro: {
      faixas: faixaRows.map(row => ({
        uf: typeof row?.uf === 'string' ? row.uf.toUpperCase().slice(0, 2) : '',
        valor_minimo: normalizeNumber(row?.valor_minimo),
        valor_maximo: normalizeNumber(row?.valor_maximo),
        tarifa: normalizeNumber(row?.tarifa),
      })),
    },
    seguros: {
      mip_percentual_mensal: normalizeNumber(raw.seguros?.mip_percentual_mensal),
      mip_base: normalizeBase(raw.seguros?.mip_base),
      dfi_percentual_mensal: normalizeNumber(raw.seguros?.dfi_percentual_mensal),
      dfi_base: normalizeBase(raw.seguros?.dfi_base),
    },
  }
}

export function validarSimuladorParametrosRascunho(parameters: SimuladorParametros): string | null {
  const percentageFields: Array<[string, number | null]> = [
    ['IOF adicional', parameters.iof.percentual_adicional],
    ['IOF diário', parameters.iof.percentual_diario],
    ['TAC', parameters.tac.percentual],
    ['Seguro MIP', parameters.seguros.mip_percentual_mensal],
    ['Seguro DFI', parameters.seguros.dfi_percentual_mensal],
  ]
  for (const [label, value] of percentageFields) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      return `${label}: informe um percentual entre 0 e 100.`
    }
  }

  if (parameters.iof.limite_dias !== null
    && (!Number.isInteger(parameters.iof.limite_dias) || parameters.iof.limite_dias < 0 || parameters.iof.limite_dias > 3650)) {
    return 'IOF: o limite de dias deve ser um número inteiro entre 0 e 3.650.'
  }
  if (parameters.tac.minimo_reais !== null && (!Number.isFinite(parameters.tac.minimo_reais) || parameters.tac.minimo_reais < 0)) {
    return 'TAC: o valor mínimo não pode ser negativo.'
  }

  for (const [index, range] of parameters.registro.faixas.entries()) {
    if (!/^([A-Z]{2}|\*)$/.test(range.uf)) return `Registro: informe uma UF válida ou * na faixa ${index + 1}.`
    if (range.valor_minimo === null || range.tarifa === null || range.valor_minimo < 0 || range.tarifa < 0) {
      return `Registro: informe valor mínimo e tarifa não negativos na faixa ${index + 1}.`
    }
    if (range.valor_maximo !== null && range.valor_maximo <= range.valor_minimo) {
      return `Registro: o valor máximo precisa ser maior que o mínimo na faixa ${index + 1}.`
    }
  }

  const sortedRanges = [...parameters.registro.faixas].sort((a, b) => a.uf.localeCompare(b.uf) || (a.valor_minimo ?? 0) - (b.valor_minimo ?? 0))
  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previous = sortedRanges[index - 1]
    const current = sortedRanges[index]
    if (previous.uf === current.uf
      && (previous.valor_maximo === null || current.valor_minimo === null || current.valor_minimo < previous.valor_maximo)) {
      return `Registro: há faixas sobrepostas para ${current.uf || 'UF não informada'}.`
    }
  }
  return null
}

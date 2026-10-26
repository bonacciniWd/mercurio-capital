export type TipoSimulacaoLead = 'home_equity' | 'amortizacao'
export type CondicaoTipoSimulacao = TipoSimulacaoLead | 'todos'

export interface RegraMensagemSimulador {
  id: string
  ativo: boolean
  prioridade: number
  tipo_simulacao: CondicaoTipoSimulacao
  valor_minimo: number | null
  valor_maximo: number | null
  mensagem: string
}

export interface ConfigMensagensSimulador {
  fallback: string
  regras: RegraMensagemSimulador[]
}

export interface LeadMensagemContext {
  nome: string
  tipo: TipoSimulacaoLead
  valor: number
}

export const DEFAULT_SIMULATION_MESSAGE = 'Olá {{nome}}, notamos que você recentemente realizou uma consulta em nossa calculadora de {{tipo_calculadora}}, no valor de {{valor_simulado}}. Você gostaria de uma ajuda?'

export const DEFAULT_SIMULATION_MESSAGE_CONFIG: ConfigMensagensSimulador = {
  fallback: DEFAULT_SIMULATION_MESSAGE,
  regras: [],
}

export function resolveSimulationMessage(config: ConfigMensagensSimulador | null | undefined, context: LeadMensagemContext): string {
  const rules = (config?.regras ?? []).filter(rule => rule.ativo).sort((a, b) => a.prioridade - b.prioridade || a.id.localeCompare(b.id))
  const match = rules.find(rule => (
    (rule.tipo_simulacao === 'todos' || rule.tipo_simulacao === context.tipo)
    && (rule.valor_minimo === null || context.valor >= rule.valor_minimo)
    && (rule.valor_maximo === null || context.valor <= rule.valor_maximo)
  ))
  const template = match?.mensagem || config?.fallback || DEFAULT_SIMULATION_MESSAGE
  const values: Record<string, string> = {
    nome: context.nome.trim() || 'cliente',
    tipo_calculadora: context.tipo === 'amortizacao' ? 'amortização' : 'Home Equity',
    valor_simulado: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.valor),
  }
  return template.replace(/\{\{(nome|tipo_calculadora|valor_simulado)\}\}/g, (_, key: string) => values[key] ?? '')
}

export function buildWhatsappUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 10 && digits.length !== 11) return null
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`
}

export function formatLeadPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone || 'Não informado'
}

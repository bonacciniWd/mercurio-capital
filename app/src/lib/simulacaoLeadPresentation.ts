export type LeadRow = {
  id: string
  status_comercial?: CommercialStatus | null
  status_comercial_updated_at?: string | null
  status_comercial_updated_by?: string | null
  tipo_simulacao: 'home_equity' | 'amortizacao' | 'cpc'
  nome_completo: string
  email: string
  telefone: string
  consentimento_em: string
  consentimento_versao: string
  valor_imovel: number | string | null
  valor_credito: number | string | null
  prazo_meses: number
  taxa_juros_mensal: number | string
  parcela_estimada: number | string | null
  ltv: number | string | null
  tipo_imovel: string | null
  situacao_imovel: string | null
  cep: string | null
  renda_mensal: number | string | null
  objetivo_credito: string | null
  tipo_renda: string | null
  prazo_contratacao: string | null
  origem: string | null
  data_inicio: string | null
  periodicidade_juros: 'mensal' | 'anual' | null
  sistema_amortizacao: 'price' | 'sac' | null
  quantidade_parcelas: number | null
  taxa_juros_informada: number | string | null
  primeira_parcela: number | string | null
  ultima_parcela: number | string | null
  total_pago: number | string | null
  total_juros: number | string | null
  planos_amortizacao: Array<{ valor_extra: number; objetivo: 'prazo' | 'parcela'; frequencia: 'unica' | 'mensal'; apos_parcela: number }> | null
  resultado_com_amortizacao: {
    economia_juros?: number
    parcelas_reduzidas?: number
    sem_antecipacao?: { total_pago?: number; total_juros?: number; quantidade_parcelas?: number }
    com_antecipacao?: { total_pago?: number; total_juros?: number; quantidade_parcelas?: number; total_amortizado_extra?: number }
  } | null
  status_email_prospect: 'pendente' | 'enviado' | 'erro' | 'sem_template' | null
  status_email_interno: 'pendente' | 'enviado' | 'erro' | 'sem_destinatarios' | 'sem_template' | null
  cidade?: string | null
  uf?: string | null
  fase_projeto?: string | null
  resumo_projeto?: string | null
  created_at: string
}

export type CommercialStatus = 'novo' | 'em_contato' | 'qualificado'

export const commercialStatusLabel: Record<CommercialStatus, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  qualificado: 'Qualificado',
}

export type EmailStatus = Exclude<LeadRow['status_email_prospect'] | LeadRow['status_email_interno'], null>

type NumericValue = number | string | null | undefined

function numberOrNull(value: NumericValue): number | null {
  if (value == null || (typeof value === 'string' && !value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function leadMoney(value: NumericValue): string {
  const parsed = numberOrNull(value)
  return parsed === null ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsed)
}

export function leadPercent(value: NumericValue, multiplier = 1): string {
  const parsed = numberOrNull(value)
  return parsed === null ? 'Não informado' : `${(parsed * multiplier).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

export function leadReceived(value: string): { date: string; time: string } {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return { date: 'Não informado', time: '' }
  return {
    date: date.toLocaleDateString('pt-BR'),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

const propertyLabels: Record<string, string> = {
  casa: 'Casa', casa_condominio: 'Casa em condomínio', apartamento: 'Apartamento',
  comercial: 'Sala comercial', terreno: 'Terreno', terreno_condominio: 'Terreno em condomínio fechado',
  predio: 'Prédio', galpao: 'Galpão', fabrica: 'Fábrica', outros: 'Outros',
}

export function leadProperty(value: string | null): string {
  return value ? propertyLabels[value] ?? value : 'Não informado'
}

export function leadPropertyStatus(value: string | null): string {
  return value === 'quitado' ? 'Quitado' : value === 'financiado' ? 'Financiado' : value || 'Não informado'
}

export function leadCep(value: string | null): string {
  const digits = value?.replace(/\D/g, '')
  return digits?.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value || 'Não informado'
}

export function leadType(lead: LeadRow): string {
  if (lead.tipo_simulacao === 'cpc') return 'Crédito para Construção · CPC'
  return lead.tipo_simulacao === 'amortizacao' ? 'Amortização' : 'Home Equity'
}

export function leadSystem(lead: LeadRow): string {
  return lead.sistema_amortizacao === 'sac' ? 'Tabela SAC' : lead.sistema_amortizacao === 'price' ? 'Tabela Price' : 'Não informado'
}

export function leadTerm(lead: LeadRow): string {
  if (lead.tipo_simulacao === 'cpc') return 'Não aplicável'
  const value = lead.tipo_simulacao === 'amortizacao' ? lead.quantidade_parcelas : lead.prazo_meses
  return value == null ? 'Prazo não informado' : `${value} ${lead.tipo_simulacao === 'amortizacao' ? 'parcelas' : 'meses'}`
}

export function leadProjectStage(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    terreno_definido: 'Terreno definido',
    projeto_aprovado: 'Projeto aprovado',
    orcamento_cronograma: 'Orçamento e cronograma disponíveis',
    obra_iniciada: 'Obra iniciada',
    outro: 'Outro',
  }
  return value ? labels[value] ?? value : 'Não informado'
}

export function emailStatusLabel(status: EmailStatus): string {
  return {
    pendente: 'Pendente', enviado: 'Enviado', erro: 'Erro',
    sem_template: 'Sem template', sem_destinatarios: 'Sem destinatários',
  }[status] ?? 'Não informado'
}

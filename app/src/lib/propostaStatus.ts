export const PROPOSTA_KANBAN_STATUS = [
  'pre_analise', 'analise_juridica', 'analise_credito', 'analise_imovel',
  'comite', 'proposta_cliente', 'diligencia_juridica', 'emissao_contrato',
  'aguardando_assinatura', 'protocolo_cartorio', 'exigencias_cartorio',
  'custas_cartorio', 'registro_af', 'recurso_liberado',
  'pagamento_comissao', 'completo',
] as const

export type PropostaKanbanStatus = typeof PROPOSTA_KANBAN_STATUS[number]

export const PROPOSTA_STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho', pre_analise: 'Pré-análise', analise_juridica: 'Análise Jurídica',
  analise_credito: 'Análise Crédito', analise_imovel: 'Análise Imóvel', comite: 'Comitê',
  proposta_cliente: 'Proposta ao Cliente', diligencia_juridica: 'Diligência Jurídica',
  emissao_contrato: 'Emissão de Contrato', aguardando_assinatura: 'Aguardando Assinatura',
  protocolo_cartorio: 'Protocolo Cartório', exigencias_cartorio: 'Exigências Cartório',
  custas_cartorio: 'Custas Cartório', registro_af: 'Registro de AF',
  recurso_liberado: 'Recurso Liberado', pagamento_comissao: 'Pagamento de Comissão',
  completo: 'Completo', cancelado: 'Cancelado',
  resolucao_pendencias: 'Diligência Jurídica (legado)',
  em_registro: 'Protocolo Cartório (legado)',
  contrato_registrado: 'Registro de AF (legado)',
}

export const LEGACY_KANBAN_STATUS_MAP: Record<string, PropostaKanbanStatus> = {
  resolucao_pendencias: 'diligencia_juridica',
  em_registro: 'protocolo_cartorio',
  contrato_registrado: 'registro_af',
}

export function toKanbanStatus(status: string): PropostaKanbanStatus | null {
  if ((PROPOSTA_KANBAN_STATUS as readonly string[]).includes(status)) return status as PropostaKanbanStatus
  return LEGACY_KANBAN_STATUS_MAP[status] ?? null
}

export const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

// Status em que a proposta ainda NÃO está aprovada (pré-aprovação) + cancelado.
const STATUS_NAO_APROVADA = new Set<string>([
  'simulacao', 'pre_analise', 'analise_credito', 'analise_imovel',
  'analise_juridica', 'comite', 'cancelado',
])

/** Proposta "aprovada": status fora do conjunto de pré-aprovação/cancelado. */
export function isPropostaAprovada(status: string): boolean {
  return !STATUS_NAO_APROVADA.has(status)
}
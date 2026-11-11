export const PRODUTO_LABEL: Record<string, string> = { home_equity: 'Home Equity', credito_construcao: 'Crédito Construção', financiamento_imobiliario: 'Financiamento Imobiliário' }
const STATUS: Record<string, string> = {
  simulacao: 'Rascunho', pre_analise: 'Pré-análise', analise_credito: 'Análise de crédito', pre_aprovado: 'Pré-aprovado', analise_imovel: 'Análise do imóvel', analise_juridica: 'Análise jurídica', comite: 'Comitê', proposta_cliente: 'Proposta ao cliente', resolucao_pendencias: 'Diligência jurídica', diligencia_juridica: 'Diligência jurídica', emissao_contrato: 'Emissão de contrato', aguardando_assinatura: 'Aguardando assinatura', em_registro: 'Protocolo cartório', protocolo_cartorio: 'Protocolo cartório', exigencias_cartorio: 'Exigências cartório', custas_cartorio: 'Custas cartório', contrato_registrado: 'Registro de AF', registro_af: 'Registro de AF', recurso_liberado: 'Recurso liberado', pagamento_comissao: 'Pagamento de comissão', completo: 'Concluída', cancelado: 'Cancelada', standby: 'Em espera',
}
export const statusLabel = (status: string) => STATUS[status] ?? 'Status em atualização'
export const propostaEncerrada = (status: string) => ['cancelado', 'completo'].includes(status)
export const propostaAcionavel = (status: string) => !['cancelado', 'completo', 'standby', 'simulacao'].includes(status) && status in STATUS
export function priorizarPropostas<T extends { status: string; updated_at: string }>(items: T[]): T[] {
  const prioridade = (status: string) => propostaAcionavel(status) ? 0 : propostaEncerrada(status) ? 2 : 1
  return [...items].sort((a, b) => prioridade(a.status) - prioridade(b.status) || Date.parse(b.updated_at) - Date.parse(a.updated_at))
}
export function valorBRL(value: number | string | null | undefined): string {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return 'Não informado'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
export function dataBR(value?: string | null): string { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('pt-BR') : 'Não informada' }
export function contratoDisponivel(status: string): boolean {
  return ['proposta_cliente', 'resolucao_pendencias', 'diligencia_juridica', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'protocolo_cartorio', 'exigencias_cartorio', 'custas_cartorio', 'contrato_registrado', 'registro_af', 'recurso_liberado', 'pagamento_comissao', 'completo'].includes(status)
}

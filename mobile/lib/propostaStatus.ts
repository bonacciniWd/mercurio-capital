// Status em que a proposta ainda NÃO está aprovada (pré-aprovação) + cancelado.
const STATUS_NAO_APROVADA = new Set<string>([
  'simulacao', 'pre_analise', 'analise_credito', 'analise_imovel',
  'analise_juridica', 'comite', 'cancelado',
])

/** Proposta "aprovada": status fora do conjunto de pré-aprovação/cancelado. */
export function isPropostaAprovada(status: string): boolean {
  return !STATUS_NAO_APROVADA.has(status)
}

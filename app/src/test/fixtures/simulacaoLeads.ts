import type { LeadRow } from '@/lib/simulacaoLeadPresentation'

/** Synthetic records for local UI tests; never persisted or sent to integrations. */
export function simulationLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 'lead-home', tipo_simulacao: 'home_equity', nome_completo: 'Marina Exemplo',
    email: 'marina@example.com', telefone: '11987654321', consentimento_em: '2026-10-08T15:00:00Z', consentimento_versao: 'simulador_publico_v2',
    valor_imovel: 850000, valor_credito: 350000, prazo_meses: 240, taxa_juros_mensal: 1.29,
    parcela_estimada: 4733.35, ltv: 350000 / 850000, tipo_imovel: 'apartamento',
    situacao_imovel: 'quitado', cep: '01001000', renda_mensal: 30000,
    objetivo_credito: 'Capital de giro', tipo_renda: 'Empresário', prazo_contratacao: 'Em até 1 mês',
    origem: 'Site da Mercúrio', data_inicio: null, periodicidade_juros: null, sistema_amortizacao: null,
    quantidade_parcelas: null, taxa_juros_informada: null, primeira_parcela: null, ultima_parcela: null,
    total_pago: null, total_juros: null, planos_amortizacao: null, resultado_com_amortizacao: null,
    status_email_prospect: 'enviado', status_email_interno: 'enviado', created_at: '2026-10-08T15:00:00Z',
    ...overrides,
  }
}

export const simulationLeadExamples: LeadRow[] = [
  simulationLead({
    id: 'lead-sac', nome_completo: 'Alexandre Exemplo de Nome Completo Extenso', email: 'alexandre.sobrenome.exemplo@empresa-de-demonstracao.example.com',
    tipo_simulacao: 'amortizacao', valor_credito: 1000000, valor_imovel: null, ltv: null,
    parcela_estimada: 17066.67, renda_mensal: null, tipo_imovel: 'casa_condominio', cep: '88338270',
    data_inicio: '2026-10-07', periodicidade_juros: 'mensal', sistema_amortizacao: 'sac',
    quantidade_parcelas: 240, taxa_juros_informada: 1.29, primeira_parcela: 17066.67, ultima_parcela: 4220.42,
    total_pago: 2554450, total_juros: 1554450,
    planos_amortizacao: [{ valor_extra: 52000, objetivo: 'prazo', frequencia: 'unica', apos_parcela: 12 }],
    resultado_com_amortizacao: {
      economia_juros: 28000, parcelas_reduzidas: 12,
      sem_antecipacao: { total_pago: 2554450, total_juros: 1554450, quantidade_parcelas: 240 },
      com_antecipacao: { total_pago: 2526450, total_juros: 1526450, quantidade_parcelas: 228, total_amortizado_extra: 52000 },
    },
  }),
  simulationLead({
    id: 'lead-price', nome_completo: 'Renato Exemplo', email: 'renato@example.com', tipo_simulacao: 'amortizacao',
    valor_credito: 1000000, primeira_parcela: 13523.91, ultima_parcela: null, total_pago: null, total_juros: null,
    quantidade_parcelas: 240, sistema_amortizacao: 'price', renda_mensal: 0, tipo_imovel: 'comercial',
    planos_amortizacao: [], status_email_prospect: 'enviado', status_email_interno: 'erro',
  }),
  simulationLead(),
  simulationLead({ id: 'lead-incomplete', nome_completo: 'Contato Exemplo', email: 'contato@example.com', telefone: '123', status_email_prospect: 'pendente', status_email_interno: 'sem_destinatarios', tipo_imovel: null, renda_mensal: null }),
]

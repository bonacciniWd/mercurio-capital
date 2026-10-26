import { describe, expect, it } from 'vitest'
import { incluiStatusNaVisaoKanban, isPropostaAprovada, PROPOSTA_KANBAN_STATUS, toKanbanStatus } from '@/lib/propostaStatus'

describe('propostaStatus', () => {
  it('mantém a ordem operacional definida pelo negócio', () => {
    expect(PROPOSTA_KANBAN_STATUS).toEqual([
      'standby', 'pre_analise', 'analise_juridica', 'analise_credito', 'pre_aprovado', 'analise_imovel',
      'comite', 'proposta_cliente', 'diligencia_juridica', 'emissao_contrato',
      'aguardando_assinatura', 'protocolo_cartorio', 'exigencias_cartorio',
      'custas_cartorio', 'registro_af', 'recurso_liberado',
      'pagamento_comissao', 'completo',
    ])
  })

  it('mantém Standby visível no quadro operacional e permite filtrá-lo', () => {
    expect(incluiStatusNaVisaoKanban('standby', 'operacional')).toBe(true)
    expect(incluiStatusNaVisaoKanban('standby', 'standby')).toBe(true)
    expect(incluiStatusNaVisaoKanban('analise_credito', 'standby')).toBe(false)
    expect(incluiStatusNaVisaoKanban('simulacao', 'operacional')).toBe(false)
  })

  it('mantém Pré-aprovado fora das etapas consideradas aprovadas', () => {
    expect(isPropostaAprovada('pre_aprovado')).toBe(false)
  })

  it('mapeia status legados sem ocultar propostas', () => {
    expect(toKanbanStatus('resolucao_pendencias')).toBe('diligencia_juridica')
    expect(toKanbanStatus('em_registro')).toBe('protocolo_cartorio')
    expect(toKanbanStatus('contrato_registrado')).toBe('registro_af')
    expect(toKanbanStatus('status_desconhecido')).toBeNull()
  })
})

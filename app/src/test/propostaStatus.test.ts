import { describe, expect, it } from 'vitest'
import { PROPOSTA_KANBAN_STATUS, toKanbanStatus } from '@/lib/propostaStatus'

describe('propostaStatus', () => {
  it('mantém a ordem operacional definida pelo negócio', () => {
    expect(PROPOSTA_KANBAN_STATUS).toEqual([
      'pre_analise', 'analise_juridica', 'analise_credito', 'analise_imovel',
      'comite', 'proposta_cliente', 'diligencia_juridica', 'emissao_contrato',
      'aguardando_assinatura', 'protocolo_cartorio', 'exigencias_cartorio',
      'custas_cartorio', 'registro_af', 'recurso_liberado',
      'pagamento_comissao', 'completo',
    ])
  })

  it('mapeia status legados sem ocultar propostas', () => {
    expect(toKanbanStatus('resolucao_pendencias')).toBe('diligencia_juridica')
    expect(toKanbanStatus('em_registro')).toBe('protocolo_cartorio')
    expect(toKanbanStatus('contrato_registrado')).toBe('registro_af')
    expect(toKanbanStatus('status_desconhecido')).toBeNull()
  })
})
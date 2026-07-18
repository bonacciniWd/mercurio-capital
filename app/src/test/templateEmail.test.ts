import { describe, expect, it } from 'vitest'
import {
  extractTemplatePlaceholders,
  presetForTemplate,
  renderTemplatePreview,
} from '@/lib/templateEmail'

describe('templateEmail', () => {
  it('extrai placeholders únicos do assunto e corpo', () => {
    expect(extractTemplatePlaceholders(
      'Proposta {{ protocolo }}',
      '<p>Olá {{cliente_nome}}, protocolo {{protocolo}}</p>',
    )).toEqual(['cliente_nome', 'protocolo'])
  })

  it('renderiza variáveis e preserva placeholders sem valor', () => {
    expect(renderTemplatePreview('Olá {{nome}} — {{status}}', { nome: 'Ana' }))
      .toBe('Olá Ana — {{status}}')
  })

  it('fornece preset conhecido e fallback para template customizado', () => {
    expect(presetForTemplate('proposta_status_changed_v1', []).protocolo)
      .toBe('MERC-2026-000123')
    expect(presetForTemplate('custom', ['nome']))
      .toEqual({ nome: 'Exemplo: nome' })
  })
})

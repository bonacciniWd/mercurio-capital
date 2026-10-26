import { describe, expect, it } from 'vitest'
import { buildWhatsappUrl, DEFAULT_SIMULATION_MESSAGE_CONFIG, resolveSimulationMessage } from './mensagensSimulador'

describe('mensagens de contato do simulador', () => {
  it('usa a regra ativa mais prioritária que corresponde ao tipo e faixa de valor', () => {
    const config = {
      fallback: 'padrão {{nome}}',
      regras: [
        { id: '2', ativo: true, prioridade: 2, tipo_simulacao: 'todos' as const, valor_minimo: 500_000, valor_maximo: null, mensagem: 'alto {{valor_simulado}}' },
        { id: '1', ativo: true, prioridade: 1, tipo_simulacao: 'amortizacao' as const, valor_minimo: 100_000, valor_maximo: 500_000, mensagem: 'Oi {{nome}}: {{tipo_calculadora}} / {{valor_simulado}}' },
      ],
    }
    expect(resolveSimulationMessage(config, { nome: 'Maria Silva', tipo: 'amortizacao', valor: 300_000 }))
      .toBe('Oi Maria Silva: amortização / R$ 300.000,00')
    expect(resolveSimulationMessage(config, { nome: 'Maria Silva', tipo: 'home_equity', valor: 300_000 })).toBe('padrão Maria Silva')
  })

  it('aplica o modelo padrão e cria link WhatsApp sem enviar a mensagem', () => {
    const message = resolveSimulationMessage(DEFAULT_SIMULATION_MESSAGE_CONFIG, { nome: 'Ana', tipo: 'home_equity', valor: 250_000 })
    const url = buildWhatsappUrl('(47) 99999-8888', message)
    expect(url).toContain('https://wa.me/5547999998888?text=')
    expect(decodeURIComponent(url ?? '')).toContain('Olá Ana')
    expect(buildWhatsappUrl('123', message)).toBeNull()
  })
})

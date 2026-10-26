import { describe, expect, it } from 'vitest'
import {
  normalizarSimuladorParametros,
  simuladorParametrosVazios,
  validarSimuladorParametrosRascunho,
} from './simuladorParametros'

describe('premissas do simulador comercial', () => {
  it('começa como rascunho pendente, sem inventar valores financeiros', () => {
    const empty = simuladorParametrosVazios()
    expect(empty.status).toBe('aguardando_validacao_financeira')
    expect(empty.iof.percentual_adicional).toBeNull()
    expect(empty.tac.percentual).toBeNull()
    expect(empty.registro.faixas).toEqual([])
    expect(empty.seguros.mip_percentual_mensal).toBeNull()
  })

  it('normaliza dados do banco sem aceitar estado ativo vindo do cliente', () => {
    const value = normalizarSimuladorParametros({
      versao: 4,
      status: 'ativo',
      iof: { percentual_adicional: '0.38', base: 'saldo_devedor' },
      registro: { faixas: [{ uf: 'sp', valor_minimo: '100', valor_maximo: null, tarifa: '15' }] },
    })
    expect(value.versao).toBe(4)
    expect(value.status).toBe('aguardando_validacao_financeira')
    expect(value.iof.percentual_adicional).toBe(0.38)
    expect(value.registro.faixas[0]).toEqual({ uf: 'SP', valor_minimo: 100, valor_maximo: null, tarifa: 15 })
  })

  it('aceita rascunho incompleto, mas rejeita percentuais negativos ou fora da faixa', () => {
    expect(validarSimuladorParametrosRascunho(simuladorParametrosVazios())).toBeNull()
    const invalid = simuladorParametrosVazios()
    invalid.seguros.dfi_percentual_mensal = 101
    expect(validarSimuladorParametrosRascunho(invalid)).toMatch(/DFI/)
  })

  it('rejeita faixas de registro sobrepostas e valores incompletos', () => {
    const invalid = simuladorParametrosVazios()
    invalid.registro.faixas = [
      { uf: 'SP', valor_minimo: 0, valor_maximo: 500_000, tarifa: 500 },
      { uf: 'SP', valor_minimo: 400_000, valor_maximo: null, tarifa: 900 },
    ]
    expect(validarSimuladorParametrosRascunho(invalid)).toMatch(/sobrepostas/)

    invalid.registro.faixas = [{ uf: '', valor_minimo: 0, valor_maximo: null, tarifa: 10 }]
    expect(validarSimuladorParametrosRascunho(invalid)).toMatch(/UF válida/)

    invalid.registro.faixas = [{ uf: 'RJ', valor_minimo: null, valor_maximo: null, tarifa: null }]
    expect(validarSimuladorParametrosRascunho(invalid)).toMatch(/valor mínimo e tarifa/)
  })
})

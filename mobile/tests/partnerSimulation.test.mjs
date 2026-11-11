import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSimulationParams } from '../lib/partnerSimulation.ts'

test('parâmetros de simulação preenchem apenas campos financeiros válidos', () => {
  const parsed = parseSimulationParams({
    sim_produto: 'credito_construcao', sim_pessoa_tipo: 'PJ', sim_valor: '600000',
    sim_garantia: '1500000', sim_prazo: '180', sim_carencia: '3',
    sim_taxa: '1.75', sim_correcao: 'pre_fixado', sim_amortizacao: 'sac',
  })
  assert.deepEqual(parsed, {
    produto: 'credito_construcao', pessoaTipo: 'PJ', valor: 600000,
    valorGarantia: 1500000, prazoMeses: 180, carenciaMeses: 3,
    taxaMensalPercentual: 1.75, taxaMensal: 0.0175,
    correcao: 'pre_fixado', amortizacao: 'sac',
  })
})

test('valores fora das regras não entram na proposta', () => {
  const parsed = parseSimulationParams({
    sim_produto: 'admin', sim_valor: '-1', sim_prazo: '360',
    sim_taxa: 'Infinity', sim_carencia: '4', sim_amortizacao: 'unknown',
  })
  assert.deepEqual(parsed, {})
})

import { describe, expect, it } from 'vitest'
import { sumFundWinnerTotals } from './fundosDashboard'

describe('totais da distribuição por fundos', () => {
  it('soma somente as operações já atribuídas a um fundo vencedor', () => {
    const rows = [
      { operacoes_representadas: 3, operacoes_unicas: 1, volume_solicitado: 500_000, volume_ganho: 500_000 },
      { operacoes_representadas: 3, operacoes_unicas: 0, volume_solicitado: 0, volume_ganho: 0 },
      { operacoes_representadas: 2, operacoes_unicas: 1, volume_solicitado: 700_000, volume_ganho: 0 },
    ]

    expect(sumFundWinnerTotals(rows)).toEqual({
      operacoes_unicas: 2,
      volume_solicitado: 1_200_000,
      volume_ganho: 500_000,
    })
  })
})

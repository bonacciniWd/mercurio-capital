export interface FundWinnerTotalsRow {
  operacoes_unicas: number | string
  volume_solicitado: number | string
  volume_ganho: number | string
}

export interface FundWinnerTotals {
  operacoes_unicas: number
  volume_solicitado: number
  volume_ganho: number
}

export function sumFundWinnerTotals(rows: readonly FundWinnerTotalsRow[]): FundWinnerTotals {
  return rows.reduce<FundWinnerTotals>((sum, row) => ({
    operacoes_unicas: sum.operacoes_unicas + Number(row.operacoes_unicas),
    volume_solicitado: sum.volume_solicitado + Number(row.volume_solicitado),
    volume_ganho: sum.volume_ganho + Number(row.volume_ganho),
  }), { operacoes_unicas: 0, volume_solicitado: 0, volume_ganho: 0 })
}

export type BaseComissaoParceiro = 'valor_liberado' | 'receita_bruta'

export function localDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function compactNumber(value: number): string {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute < 1_000) return `${value}`

  const divisor = absolute >= 1_000_000_000 ? 1_000_000_000 : absolute >= 1_000_000 ? 1_000_000 : 1_000
  const suffix = divisor === 1_000_000_000 ? 'B' : divisor === 1_000_000 ? 'M' : 'K'
  const scaled = absolute / divisor
  const precision = scaled >= 100 || Number.isInteger(scaled) ? 0 : 1
  return `${sign}${scaled.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: precision })} ${suffix}`
}

export function calcularCondicaoComercial(input: {
  valorBase: number
  percentualReceita: number
  baseComissaoParceiro: BaseComissaoParceiro
  percentualParceiro: number
}) {
  const receitaBruta = roundMoney(input.valorBase * input.percentualReceita / 100)
  const baseParceiro = input.baseComissaoParceiro === 'valor_liberado' ? input.valorBase : receitaBruta
  const comissaoParceiro = roundMoney(baseParceiro * input.percentualParceiro / 100)
  return {
    receitaBruta,
    baseParceiro: roundMoney(baseParceiro),
    comissaoParceiro,
    margemPreliminar: roundMoney(receitaBruta - comissaoParceiro),
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

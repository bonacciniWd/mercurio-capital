import type { ParcelaRow } from './credito'

export type PeriodicidadeJuros = 'mensal' | 'anual'

/** Converte a taxa informada para a taxa mensal efetiva usada pelo motor. */
export function taxaMensalFromInput(taxa: number, periodicidade: PeriodicidadeJuros): number {
  if (!Number.isFinite(taxa) || taxa < 0) return 0
  if (periodicidade === 'mensal') return taxa / 100
  return Math.pow(1 + (taxa / 100), 1 / 12) - 1
}

/** Retorna uma data input no calendário local, sem conversão pelo fuso do servidor. */
export function todayDateInput(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Soma meses preservando o dia quando possível e ajustando para o último dia do mês. */
export function addMonthsToDateInput(value: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const target = new Date(Date.UTC(year, month, 1, 12))
  target.setUTCMonth(target.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`
}

export function formatDateInput(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—'
}

export interface PublicAmortizationScheduleRow extends ParcelaRow {
  data: string
}

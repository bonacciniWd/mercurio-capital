import { toKanbanStatus } from './propostaStatus'

const MS_PER_DAY = 86_400_000
export const PROPOSTA_STAGE_ALERT_THRESHOLD_DAYS = 10

export function isProposalStageAgeEligible(status: string): boolean {
  const kanbanStatus = toKanbanStatus(status)
  return kanbanStatus !== null && kanbanStatus !== 'standby' && kanbanStatus !== 'completo'
}

export function getProposalStageAge(
  enteredAt: string | null | undefined,
  now = Date.now(),
): { days: number | null; overdue: boolean } {
  if (!enteredAt) return { days: null, overdue: false }
  const enteredAtMs = Date.parse(enteredAt)
  if (!Number.isFinite(enteredAtMs) || enteredAtMs > now) {
    return { days: null, overdue: false }
  }

  const elapsedMs = now - enteredAtMs
  const days = Math.floor(elapsedMs / MS_PER_DAY)
  return {
    days,
    overdue: elapsedMs > PROPOSTA_STAGE_ALERT_THRESHOLD_DAYS * MS_PER_DAY,
  }
}

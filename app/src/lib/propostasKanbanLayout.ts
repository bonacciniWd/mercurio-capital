import { PROPOSTA_KANBAN_STATUS } from '@/lib/propostaStatus'

export function propostasKanbanScrollWidth(hasLegacyColumn: boolean): string {
  const totalColumns = PROPOSTA_KANBAN_STATUS.length + Number(hasLegacyColumn)
  const widthRem = PROPOSTA_KANBAN_STATUS.length * 28 + (hasLegacyColumn ? 18 : 0)
  const gapsRem = Math.max(0, totalColumns - 1)
  return `calc(${widthRem}rem + ${gapsRem}rem)`
}

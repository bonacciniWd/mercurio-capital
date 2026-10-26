import { localDateISO } from '@/lib/financeiro'

export function rollingQuarterStartDate(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  start.setMonth(start.getMonth() - 3)
  start.setDate(Math.min(now.getDate(), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()))
  return start
}

export function isRollingQuarterRange(start: string, end: string, now: Date): boolean {
  return start === localDateISO(rollingQuarterStartDate(now)) && end === localDateISO(now)
}

export function currentCalendarMonthRange(now: Date): { inicio: string; fim: string } {
  return {
    inicio: localDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    fim: localDateISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

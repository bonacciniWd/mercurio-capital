import { describe, expect, it } from 'vitest'
import { currentCalendarMonthRange, isRollingQuarterRange, rollingQuarterStartDate } from './dashboardPeriod'

describe('período trimestral móvel do dashboard', () => {
  it('volta três meses preservando o dia civil', () => {
    const today = new Date(2026, 9, 8)
    expect(rollingQuarterStartDate(today)).toEqual(new Date(2026, 6, 8))
    expect(isRollingQuarterRange('2026-07-08', '2026-10-08', today)).toBe(true)
  })

  it('ajusta o dia quando o mês de destino é mais curto', () => {
    expect(rollingQuarterStartDate(new Date(2026, 4, 31))).toEqual(new Date(2026, 1, 28))
  })

  it('trata a virada de ano', () => {
    expect(rollingQuarterStartDate(new Date(2027, 0, 2))).toEqual(new Date(2026, 9, 2))
  })
})

describe('período mensal inicial do dashboard', () => {
  it('usa o mês calendário corrente, igual ao atalho Mês', () => {
    expect(currentCalendarMonthRange(new Date(2026, 9, 8))).toEqual({
      inicio: '2026-10-01',
      fim: '2026-10-31',
    })
  })
})

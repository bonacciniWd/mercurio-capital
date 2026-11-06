import { describe, expect, it } from 'vitest'
import { getProposalStageAge, isProposalStageAgeEligible } from './propostaStageAge'

const DAY = 86_400_000
const BASE = Date.parse('2026-11-03T12:00:00.000Z')

describe('getProposalStageAge', () => {
  it('counts complete days without using proposal updated_at', () => {
    expect(getProposalStageAge(new Date(BASE - 6 * DAY - 1).toISOString(), BASE))
      .toEqual({ days: 6, overdue: false })
  })

  it('does not alert at or before 10 full days', () => {
    expect(getProposalStageAge(new Date(BASE - 10 * DAY).toISOString(), BASE))
      .toEqual({ days: 10, overdue: false })
  })

  it('alerts only after more than 10 full days', () => {
    expect(getProposalStageAge(new Date(BASE - 10 * DAY - 1).toISOString(), BASE))
      .toEqual({ days: 10, overdue: true })
  })

  it('returns an unavailable age for missing or invalid timestamps', () => {
    expect(getProposalStageAge(null, BASE)).toEqual({ days: null, overdue: false })
    expect(getProposalStageAge('not-a-date', BASE)).toEqual({ days: null, overdue: false })
    expect(getProposalStageAge(new Date(BASE + DAY).toISOString(), BASE))
      .toEqual({ days: null, overdue: false })
  })

  it('includes active and legacy-mapped stages but excludes standby and terminal statuses', () => {
    expect(isProposalStageAgeEligible('pre_analise')).toBe(true)
    expect(isProposalStageAgeEligible('resolucao_pendencias')).toBe(true)
    expect(isProposalStageAgeEligible('contrato_registrado')).toBe(true)
    expect(isProposalStageAgeEligible('standby')).toBe(false)
    expect(isProposalStageAgeEligible('completo')).toBe(false)
    expect(isProposalStageAgeEligible('cancelado')).toBe(false)
    expect(isProposalStageAgeEligible('simulacao')).toBe(false)
    expect(isProposalStageAgeEligible('status_desconhecido')).toBe(false)
  })
})

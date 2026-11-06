import { describe, expect, it } from 'vitest'
import { getFundProposalFilterRule, sumFundRequestedVolume } from './fundProposalFilter'

describe('fund proposal filters', () => {
  it('hides Standby from the unfiltered list', () => {
    expect(getFundProposalFilterRule('all')).toEqual({
      excludedProposalStatuses: ['standby'],
    })
  })

  it('defines open operations using the existing terminal statuses', () => {
    expect(getFundProposalFilterRule('open').excludedProposalStatuses).toEqual([
      'contrato_registrado',
      'completo',
      'cancelado',
      'standby',
    ])
  })

  it('limits pending to awaiting fund links on non-terminal proposals', () => {
    expect(getFundProposalFilterRule('pending')).toEqual({
      fundLinkStatus: 'aguardando',
      excludedProposalStatuses: ['contrato_registrado', 'completo', 'cancelado', 'standby'],
    })
  })

  it('isolates cancelled proposals', () => {
    expect(getFundProposalFilterRule('cancelled')).toEqual({
      proposalStatus: 'cancelado',
      excludedProposalStatuses: [],
    })
  })

  it('sums requested amounts across all result batches', () => {
    expect(sumFundRequestedVolume(['1000000.25', 200, null, 'invalid'])).toBe(1000200.25)
  })
})

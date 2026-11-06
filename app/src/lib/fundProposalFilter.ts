export type FundProposalFilter = 'all' | 'open' | 'pending' | 'cancelled'

export const FUND_PROPOSAL_FINAL_STATUSES = [
  'contrato_registrado',
  'completo',
  'cancelado',
  'standby',
] as const

export const FUND_PROPOSAL_FILTERS: {
  value: FundProposalFilter
  label: string
}[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abertas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'cancelled', label: 'Canceladas' },
]

export function getFundProposalFilterRule(filter: FundProposalFilter) {
  if (filter === 'cancelled') {
    return { proposalStatus: 'cancelado', excludedProposalStatuses: [] as string[] }
  }
  if (filter === 'pending') {
    return { fundLinkStatus: 'aguardando', excludedProposalStatuses: [...FUND_PROPOSAL_FINAL_STATUSES] }
  }
  if (filter === 'open') {
    return { excludedProposalStatuses: [...FUND_PROPOSAL_FINAL_STATUSES] }
  }
  return { excludedProposalStatuses: ['standby'] }
}

export function sumFundRequestedVolume(values: readonly (number | string | null | undefined)[]) {
  return values.reduce<number>((sum, value) => sum + (Number(value) || 0), 0)
}

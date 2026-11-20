import { describe, expect, it } from 'vitest'
import { getSerasaProponentSelection } from '@/lib/serasaProponentSelection'

const company = { id: 'company-1', pessoa_tipo: 'PJ' }

describe('getSerasaProponentSelection', () => {
  it('does not allow a PJ query when there is no PJ proponent', () => {
    expect(getSerasaProponentSelection('serasa_pj', [])).toEqual({ mode: 'none' })
  })

  it('automatically targets the only PJ proponent', () => {
    expect(getSerasaProponentSelection('serasa_pj', [company])).toEqual({
      mode: 'automatic',
      proponent: company,
    })
  })

  it('requires a choice when there are multiple PJ proponents', () => {
    const secondCompany = { id: 'company-2', pessoa_tipo: 'PJ' }
    expect(getSerasaProponentSelection('serasa_pj', [company, secondCompany])).toEqual({
      mode: 'choose',
      proponents: [company, secondCompany],
    })
  })

  it('preserves explicit proponent selection for PF', () => {
    expect(getSerasaProponentSelection('serasa_pf', [{ id: 'person-1' }])).toEqual({
      mode: 'choose',
      proponents: [{ id: 'person-1' }],
    })
  })
})

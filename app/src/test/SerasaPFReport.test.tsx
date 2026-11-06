import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SerasaPFReport } from '@/components/SerasaPFReport'

afterEach(cleanup)

describe('relatório Serasa PF', () => {
  it('mostra endereços, telefones e e-mails em tabelas sem duplicar contatos repetidos', () => {
    render(<SerasaPFReport report={{
      normalizerVersion: 3,
      reportName: 'RELATORIO_AVANCADO_PF',
      product: 'RELATORIO_AVANCADO_PF',
      consultedAt: '2026-10-29T12:00:00Z',
      registration: {
        available: true,
        source: 'serasa',
        consumerName: 'Cliente sintético',
        address: { addressLine: 'Rua Exemplo', addressNumber: '10', zipCode: '00000-000', city: 'Cidade', state: 'SC' },
        addresses: [{ addressLine: 'Rua Exemplo', addressNumber: '10', zipCode: '00000-000', city: 'Cidade', state: 'SC' }],
        phone: { regionCode: '55', areaCode: '48', phoneNumber: '999999999', phoneType: 'Móvel' },
        phones: [{ regionCode: '55', areaCode: '48', phoneNumber: '999999999', phoneType: 'Móvel' }],
        emails: [{ email: 'cliente@example.invalid' }, { emailAddress: 'cliente@example.invalid' }],
      },
    }} />)

    expect(screen.getByText('Endereços informados')).toBeInTheDocument()
    expect(screen.getByText('Telefones informados')).toBeInTheDocument()
    expect(screen.getByText('E-mails informados')).toBeInTheDocument()
    expect(screen.getAllByText('Rua Exemplo')).toHaveLength(1)
    expect(screen.getAllByText('999999999')).toHaveLength(1)
    expect(screen.getAllByText('cliente@example.invalid')).toHaveLength(1)
    const tables = screen.getAllByRole('table')
    expect(tables).toHaveLength(3)
    expect(within(tables[0]).getByText('Logradouro')).toBeInTheDocument()
  })
})

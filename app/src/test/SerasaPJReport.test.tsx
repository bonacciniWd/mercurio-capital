import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SerasaPJReport } from '@/components/SerasaPJReport'

afterEach(cleanup)

describe('relatório Serasa PJ', () => {
  it('exibe os dados empresariais e agregados sem apresentar identificadores excluídos', () => {
    const { container } = render(<SerasaPJReport report={{
      normalizerVersion: 4,
      reportName: 'RELATORIO_AVANCADO_PJ_ANALITICO',
      product: 'RELATORIO_AVANCADO_PJ_ANALITICO',
      consultedAt: '2026-11-20T12:00:00Z',
      identityAvailable: true,
      registration: {
        state: 'returned', companyName: 'Empresa sintética', companyAlias: 'Marca sintética',
        statusRegistration: 'ATIVA', numberEmployees: 10, location: { city: 'São Paulo', state: 'SP' },
      },
      negativeData: { state: 'returned', sources: { pefin: { state: 'returned', count: 2, balance: 1250.5 } } },
      negativeSummary: { state: 'returned', hasNegative: true, summaries: [] },
      facts: { state: 'returned', inquirySummary: { state: 'returned', currentMonth: 3, currentMonthBanks: 1, historical: [] } },
      commercialPaymentHistory: { state: 'returned', paymentTotal: { periodDescription: 'Últimos meses', totalValueRangeDescription: 'Faixa A' }, supplierSummary: { sourcesTotal: 4 } },
      checkFilingsHistorical: { state: 'returned', recordsReturned: 2, quantityChecks: 5 },
    }} />)

    expect(screen.getAllByText('Empresa sintética')).toHaveLength(2)
    expect(screen.getAllByText('Situação cadastral')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Apontamentos negativos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Histórico de pagamentos comerciais' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cheques históricos' })).toBeInTheDocument()
    expect(container.textContent).toContain('1.250,50')
    expect(container.textContent).not.toContain('documentNumber')
    expect(container.textContent).not.toContain('supplierName')
    expect(container.textContent).not.toContain('accountNumber')
  })

  it('distingue registro legado e estados de seção ausente, vazio ou com erro', () => {
    const { rerender } = render(<SerasaPJReport report={{ legacy: true }} />)
    expect(screen.getByText(/anterior ao relatório PJ detalhado/i)).toBeInTheDocument()

    rerender(<SerasaPJReport report={{
      normalizerVersion: 4,
      registration: { state: 'empty' },
      negativeSummary: { state: 'not_returned' },
      negativeData: { state: 'empty', sources: {} },
      facts: { inquirySummary: { state: 'error' } },
      commercialPaymentHistory: { state: 'not_returned' },
      checkFilingsHistorical: { state: 'empty', recordsReturned: 0 },
    }} />)

    expect(screen.getAllByText('Lista vazia informada pelo bureau').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Seção não retornada nesta consulta').length).toBeGreaterThan(0)
    expect(screen.getAllByText('O bureau informou erro nesta seção').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })
})

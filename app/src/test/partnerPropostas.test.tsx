import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const fixture = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => Promise.resolve({ data: fixture.rows, error: null })
      return builder
    }),
  },
}))

import { PartnerPropostas } from '@/pages/partner/Propostas'

afterEach(() => {
  cleanup()
  fixture.rows = []
})

function makeProposal(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `proposal-${index}`,
    protocolo: `MC-2026-${String(index).padStart(6, '0')}`,
    produto: 'home_equity',
    status: 'pre_analise',
    valor_solicitado: 400_000,
    valor_imoveis_total: 1_000_000,
    created_at: '2026-10-22T12:00:00.000Z',
    updated_at: '2026-10-23T12:00:00.000Z',
    cliente: { nome_completo: `Cliente ${index}`, cpf: '12345678901' },
    ...overrides,
  }
}

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/p/propostas']}>
        <Routes>
          <Route path="/p/propostas" element={<PartnerPropostas />} />
          <Route path="/p/propostas/:id" element={<div>Detalhe partner</div>} />
          <Route path="/p/propostas/nova" element={<div>Wizard partner</div>} />
          <Route path="/p/kanban" element={<div>Kanban partner</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('listagem de propostas partner', () => {
  it('mostra 50 itens por página e preserva as rotas partner', async () => {
    fixture.rows = Array.from({ length: 55 }, (_, index) => makeProposal(index + 1))
    mount()

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(51)
    expect(screen.getByText(/Exibindo/)).toBeInTheDocument()
    expect(screen.getByText('1–50')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nova proposta' })).toHaveAttribute('href', '/p/propostas/nova')
    expect(screen.getByRole('link', { name: 'Ver Kanban' })).toHaveAttribute('href', '/p/kanban')

    fireEvent.click(screen.getByRole('button', { name: 'Ir para página 2' }))
    expect(await screen.findByText('Cliente 55')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.getByText('51–55')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Abrir proposta MC-2026-000055' }))
    expect(await screen.findByText('Detalhe partner')).toBeInTheDocument()
  })

  it('filtra por produto, status e cliente, e calcula indicadores com os dados visíveis', async () => {
    fixture.rows = [
      makeProposal(1),
      makeProposal(2, { produto: 'credito_construcao', status: 'analise_credito', valor_solicitado: 500_000 }),
    ]
    mount()

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument()
    expect(screen.getByText('2 resultados encontrados')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Buscar por protocolo, CPF ou cliente'), { target: { value: 'Cliente 2' } })
    expect(screen.getByText('Cliente 2')).toBeInTheDocument()
    expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'analise_credito' } })
    fireEvent.change(screen.getByLabelText('Produto'), { target: { value: 'credito_construcao' } })
    expect(screen.getByText('1 resultados encontrados')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Crédito Construção')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(screen.getByText('2 resultados encontrados')).toBeInTheDocument())
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3)
  })
})

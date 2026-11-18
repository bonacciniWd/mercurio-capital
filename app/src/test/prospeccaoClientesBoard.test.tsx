import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProspeccaoCliente } from '@/lib/prospeccaoCliente'

const mocks = vi.hoisted(() => ({ prospects: [] as ProspeccaoCliente[], move: vi.fn(), update: vi.fn() }))

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ session: { userId: 'partner-user', role: 'partner', partnerId: 'partner-1', equipeId: null } }),
}))

vi.mock('@/hooks/useProspeccoesClientes', () => ({
  PROSPECCOES_CLIENTES_QUERY_KEY: ['prospeccoes-clientes'],
  useProspeccaoClienteHistorico: () => ({ data: [], isPending: false, error: null }),
  useProspeccoesClientes: () => ({ data: mocks.prospects, isPending: false, isLoading: false, error: null }),
  useProspeccaoClienteCreate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProspeccaoClienteUpdate: () => ({ mutateAsync: mocks.update, isPending: false }),
  useProspeccaoClienteMove: () => ({ mutateAsync: mocks.move, mutate: vi.fn(), isPending: false, error: null }),
}))

vi.mock('@/hooks/useProspeccaoClienteAnexos', () => ({
  B2C_ANEXOS_QUERY_KEY: ['prospeccoes-clientes', 'anexos'],
  useProspeccaoClienteAnexos: () => ({ data: [], isPending: false, error: null }),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => {
  const chain = { select: () => chain, eq: () => chain, order: () => Promise.resolve({ data: [], error: null }) }
  return chain
} } }))

import { ProspeccaoClientesBoard } from '@/components/ProspeccaoClientesBoard'

function makeProspect(overrides: Partial<ProspeccaoCliente> = {}): ProspeccaoCliente {
  return {
    id: 'lead-1', partner_id: 'partner-1', equipe_id: null, responsavel_id: 'partner-user',
    nome_completo: 'Denis Cliente', email: 'denis@example.com', telefone: '47989279037',
    origem: 'indicacao', notas: null, status: 'qualificado', motivo_perda: null,
    proposta_id: null, convertido_em: null, created_at: '2026-11-18T10:00:00Z',
    updated_at: '2026-11-18T10:00:00Z', created_by: 'partner-user', updated_by: 'partner-user',
    ...overrides,
  }
}

function mount(initialEntry = '/p/prospeccao') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}><ProspeccaoClientesBoard /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => { mocks.prospects = []; mocks.move.mockReset().mockResolvedValue(undefined); mocks.update.mockReset().mockResolvedValue(undefined) })
afterEach(cleanup)

describe('ProspeccaoClientesBoard', () => {
  it('organiza a carteira B2C em etapas e oferece conversão somente a qualificados', () => {
    mocks.prospects = [makeProspect(), makeProspect({ id: 'lead-2', nome_completo: 'Maria Nova', email: 'maria@example.com', telefone: '11987654321', status: 'novo' })]
    mount()

    expect(screen.getByRole('heading', { level: 1, name: 'Prospecção de clientes' })).toBeInTheDocument()
    const qualificados = screen.getByRole('region', { name: 'Qualificados' })
    expect(within(qualificados).getByText('Denis Cliente')).toBeInTheDocument()
    expect(within(qualificados).getByRole('link', { name: /Criar proposta/ })).toHaveAttribute('href', '/p/propostas/nova?prospeccao_cliente=lead-1')
    expect(screen.getByRole('region', { name: 'Novos' })).toHaveTextContent('Maria Nova')
    expect(screen.getAllByRole('region')).toHaveLength(5)
  })

  it('filtra cards por busca do cliente', () => {
    mocks.prospects = [makeProspect(), makeProspect({ id: 'lead-2', nome_completo: 'Maria Nova', email: 'maria@example.com', telefone: '11987654321', status: 'novo' })]
    mount()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar prospect por nome, e-mail ou telefone' }), { target: { value: 'denis' } })
    expect(screen.getByText('Denis Cliente')).toBeInTheDocument()
    expect(screen.queryByText('Maria Nova')).not.toBeInTheDocument()
  })

  it('localiza e destaca prospect vindo do vínculo da proposta', async () => {
    mocks.prospects = [makeProspect()]
    mount('/p/prospeccao?prospect=lead-1')
    await waitFor(() => expect(document.getElementById('prospeccao-cliente-lead-1')).toHaveAttribute('data-highlighted', 'true'))
  })
})

describe('interações do funil B2C', () => {
  it('mantém movimento por menu para qualificados e envia o estado esperado', async () => {
    mocks.prospects = [makeProspect()]
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Denis Cliente' }))
    expect(screen.queryByRole('menuitem', { name: 'Proposta criada' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Em contato' }))
    await waitFor(() => expect(mocks.move).toHaveBeenCalledWith({ id: 'lead-1', novo_status: 'em_contato', status_esperado: 'qualificado', motivo_perda: undefined }))
  })

  it('não move para Perdidos se o motivo for cancelado', () => {
    mocks.prospects = [makeProspect()]
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Denis Cliente' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Marcar perdido…' }))
    expect(screen.getByRole('dialog', { name: 'Marcar prospect como perdido' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(mocks.move).not.toHaveBeenCalled()
  })

  it('expõe o erro de movimentação ao usuário', async () => {
    mocks.prospects = [makeProspect()]
    mocks.move.mockRejectedValueOnce(new Error('Outro usuário atualizou este prospect.'))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Denis Cliente' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Em contato' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Outro usuário atualizou')
  })

  it('abre Notas diretamente e mantém o rascunho ao trocar abas', async () => {
    mocks.prospects = [makeProspect({ notas: 'Contato inicial' })]
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Notas' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('tab', { name: 'Notas' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.change(within(dialog).getByLabelText('Notas da negociação'), { target: { value: 'Enviar condições revisadas' } })
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Dados' }))
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Notas' }))
    expect(within(dialog).getByLabelText('Notas da negociação')).toHaveValue('Enviar condições revisadas')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-1', notas: 'Enviar condições revisadas', nome_completo: 'Denis Cliente' })))
    expect(await within(dialog).findByRole('status')).toHaveTextContent('Alterações salvas')
  })

  it('exige confirmação antes de descartar notas não salvas', () => {
    mocks.prospects = [makeProspect()]
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Notas' }))
    fireEvent.change(screen.getByLabelText('Notas da negociação'), { target: { value: 'Rascunho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Descartar as alterações')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByLabelText('Notas da negociação')).toHaveValue('Rascunho')
  })

  it('consulta convertidos por abas e impede edição ou movimento', () => {
    mocks.prospects = [makeProspect({ status: 'proposta_criada', proposta_id: 'proposal-1' })]
    mount()
    expect(screen.queryByRole('button', { name: /Ações de/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Notas' }))
    expect(screen.getByLabelText('Notas da negociação')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Anexos' }))
    expect(screen.queryByRole('button', { name: 'Selecionar prints' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('Prospect convertido')
  })
})

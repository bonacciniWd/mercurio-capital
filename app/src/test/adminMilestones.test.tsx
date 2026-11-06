import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminMilestones } from '@/pages/admin/Milestones'

const mocks = vi.hoisted(() => ({
  items: [] as Array<Record<string, unknown>>,
  listError: null as { message: string } | null,
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => {
      const query: Record<string, unknown> = {}
      query.select = vi.fn(() => query)
      query.order = vi.fn().mockImplementation(() => Promise.resolve({ data: mocks.items, error: mocks.listError }))
      query.insert = vi.fn((payload: unknown) => {
        mocks.insert(payload)
        return Promise.resolve({ error: null })
      })
      query.update = vi.fn((payload: unknown) => {
        mocks.update(payload)
        return query
      })
      query.delete = vi.fn(() => {
        mocks.remove()
        return query
      })
      query.eq = vi.fn(() => Promise.resolve({ error: null }))
      return query
    }),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://assets.example.invalid/prize.png' } })),
        upload: mocks.upload,
      })),
    },
  },
}))

const milestone = {
  id: 'milestone-1',
  order_index: 1,
  label: 'R$ 5 Milhões',
  prize: 'Prêmio de exemplo',
  descricao: 'Descrição do prêmio',
  target_centavos: 500000000,
  color: '#D4AF37',
  image_url: null,
  image_storage_path: null,
  ativo: true,
  created_at: '2026-11-06T12:00:00Z',
  updated_at: '2026-11-06T12:00:00Z',
}

function renderAdminMilestones() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AdminMilestones /></QueryClientProvider>)
}

describe('AdminMilestones', () => {
  beforeEach(() => {
    mocks.items = [milestone]
    mocks.listError = null
    mocks.insert.mockReset()
    mocks.update.mockReset()
    mocks.remove.mockReset()
    mocks.upload.mockReset().mockResolvedValue({ error: null })
  })

  it('apresenta tabela desktop e itens responsivos para telas estreitas', async () => {
    renderAdminMilestones()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent('Prêmio de exemplo')
    expect(screen.getAllByText('R$ 5.000.000,00')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Editar Prêmio de exemplo' })).toHaveLength(2)
  })

  it('abre um modal organizado por seções e mantém os mesmos campos ao salvar', async () => {
    renderAdminMilestones()
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Novo milestone' }))

    const dialog = screen.getByRole('dialog', { name: 'Novo milestone' })
    expect(dialog).toHaveTextContent('Meta')
    expect(dialog).toHaveTextContent('Prêmio')
    expect(dialog).toHaveTextContent('Apresentação')

    fireEvent.change(screen.getByLabelText('Meta (R$)'), { target: { value: '5000000' } })
    fireEvent.change(screen.getByLabelText('Rótulo da meta'), { target: { value: 'R$ 5 Milhões' } })
    fireEvent.change(screen.getByLabelText('Nome do prêmio'), { target: { value: 'Prêmio teste' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      order_index: 2,
      label: 'R$ 5 Milhões',
      prize: 'Prêmio teste',
      target_centavos: 500000000,
      color: '#D4AF37',
      ativo: true,
    })))
  })

  it('mostra erro de leitura separadamente de lista vazia e permite tentar de novo', async () => {
    mocks.listError = { message: 'offline' }
    renderAdminMilestones()

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os milestones.')
    expect(screen.queryByText('Nenhum milestone cadastrado')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('mostra ação de criação quando ainda não há milestones', async () => {
    mocks.items = []
    renderAdminMilestones()

    expect(await screen.findByText('Nenhum milestone cadastrado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Criar primeiro milestone' }))
    expect(screen.getByRole('dialog', { name: 'Novo milestone' })).toBeInTheDocument()
  })
})

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  adminNivel: 'comercial' as 'comercial' | 'full',
  invoke: vi.fn(),
  rpc: vi.fn(),
}))

function rowsFor(table: string): unknown[] {
  if (table === 'v_admin_wallets') return [{
    id: 'w1', partner_id: 'p1', partner_nome: 'Parceiro Alfa', partner_email: 'alfa@example.com',
    saldo_centavos: 12500, bloqueada: false, motivo_bloqueio: null, ultima_movimentacao: null,
  }]
  if (table === 'cursos') return [{
    id: 'curso-1', titulo: 'Crédito com garantia', slug: null, descricao: 'Conteúdo do curso',
    categoria: 'Crédito', nivel: 'iniciante', publico: 'parceiro', status: 'rascunho',
    capa_storage_path: null, ordem: 1, gratuito: true, preco_centavos: null,
  }]
  return []
}

function queryFor(table: string) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'order', 'eq', 'in']) builder[method] = () => builder
  builder.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve({ data: rowsFor(table), error: null }).then(resolve, reject)
  return builder
}

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ session: { userId: 'admin-1', role: 'admin', adminNivel: mocks.adminNivel } }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => queryFor(table),
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    functions: { invoke: (...args: unknown[]) => mocks.invoke(...args) },
  },
}))

import { AdminCarteiras } from '@/pages/admin/Carteiras'
import { AdminUniversidade } from '@/pages/admin/Universidade'
import { EquipeInterna } from '@/components/admin/EquipeInterna'

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mocks.adminNivel = 'comercial'
  mocks.invoke.mockReset().mockResolvedValue({ data: { ok: true, admin_nivel: 'comercial' }, error: null })
  mocks.rpc.mockReset().mockImplementation((name: string) => {
    if (name === 'admin_internal_team_list') return Promise.resolve({ data: [], error: null })
    if (name === 'admin_internal_team_catalogs') return Promise.resolve({ data: { cargos: [], departamentos: [] }, error: null })
    return Promise.resolve({ data: null, error: null })
  })
})

afterEach(cleanup)

describe('escopo comercial de administrador', () => {
  it('Carteiras: comercial consulta saldos sem ações de ajuste e bloqueio', async () => {
    renderWithQuery(<AdminCarteiras />)
    await screen.findByText('Parceiro Alfa')
    expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Crédito')).not.toBeInTheDocument()
    expect(screen.getByText('Consulta de saldos e movimentações em modo somente leitura.')).toBeInTheDocument()
  })

  it('Universidade: comercial visualiza o curso sem controles de escrita', async () => {
    renderWithQuery(<AdminUniversidade />)
    await screen.findByRole('heading', { level: 2, name: 'Crédito com garantia' })
    expect(screen.getByText('Acesso somente leitura para este nível administrativo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo curso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo módulo' })).not.toBeInTheDocument()
    expect(screen.getByText('Conteúdo do curso')).toBeInTheDocument()
  })

  it('convite interno envia o nível comercial escolhido à Edge Function', async () => {
    render(<EquipeInterna />)
    fireEvent.click(await screen.findByRole('button', { name: 'Convidar colaborador' }))
    const dialog = await screen.findByRole('dialog', { name: 'Convidar usuário interno' })
    fireEvent.change(within(dialog).getByLabelText('Nível de acesso'), { target: { value: 'comercial' } })
    fireEvent.change(within(dialog).getByLabelText('Nome completo'), { target: { value: 'Ana Comercial' } })
    fireEvent.change(within(dialog).getByLabelText('E-mail corporativo'), { target: { value: 'ana@example.com' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar convite' }))

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('admin-invite-internal', {
      body: { nome_completo: 'Ana Comercial', email: 'ana@example.com', p_nivel: 'comercial' },
    }))
    expect(await screen.findByText('Convite enviado. O novo usuário receberá acesso administrativo comercial.')).toBeInTheDocument()
  })
})

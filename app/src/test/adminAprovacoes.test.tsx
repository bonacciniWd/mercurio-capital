import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { AdminAprovacoes } from '@/pages/admin/Aprovacoes'

const fixtures = vi.hoisted(() => ({
  partner: {
    partner_id: 'partner-1', usuario_id: 'user-1', status: 'pending', cpf: '***.123.456-**',
    nome: 'Parceiro Sintético', email: 'parceiro@example.invalid', telefone: '11999990000', telefone_ddi: '55',
    endereco_cidade: 'São Paulo', endereco_estado: 'SP', ultimo_login_at: null, created_at: '2026-10-20T12:00:00Z',
    aprovado_em: null, motivo_rejeicao: null, docs_count: 1, origem: 'auto_cadastro', invite_id: null,
    invite_observacoes: null, invite_criado_por_nome: null, invite_created_at: null, invite_status: null,
  },
  document: {
    id: 'doc-1', tipo: 'Contrato social', storage_path: 'partner-1/contrato.pdf', mime_type: 'application/pdf',
    tamanho_bytes: 108544, validado: false, created_at: '2026-10-20T12:00:00Z',
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: table === 'v_admin_partner_aprovacoes' ? [fixtures.partner] : [fixtures.document], error: null }
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'order', 'limit']) builder[method] = () => builder
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return builder
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example.invalid/signed-document' }, error: null }) })) },
  },
}))

afterEach(() => cleanup())
beforeEach(() => vi.clearAllMocks())

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={queryClient}><MemoryRouter><AdminAprovacoes /></MemoryRouter></QueryClientProvider>)
}

describe('aprovações de parceiros no Admin', () => {
  it('pesquisa e filtra solicitações sem perder a seleção do parceiro', async () => {
    mount()
    await screen.findByRole('heading', { name: 'Parceiro Sintético' })
    expect(screen.getByRole('heading', { name: 'Aprovações de parceiros' })).toBeInTheDocument()
    expect(screen.getByText('Acesso seguro')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome, e-mail ou CPF' }), { target: { value: 'inexistente' } })
    expect(await screen.findByText('Nenhum parceiro encontrado')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome, e-mail ou CPF' }), { target: { value: 'sintético' } })
    expect(await screen.findByText('Contrato social')).toBeInTheDocument()
  })

  it('cria URL assinada apenas ao abrir e exibe o PDF no modal interno, que fecha com Escape', async () => {
    mount()
    await screen.findByText('Contrato social')
    expect(supabase.storage.from).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /visualizar/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Contrato social' })
    const storage = supabase.storage.from as ReturnType<typeof vi.fn>
    expect(storage).toHaveBeenCalledWith('partner_docs')
    expect(within(dialog).getByTitle('Documento PDF: Contrato social')).toHaveAttribute('src', 'https://storage.example.invalid/signed-document')
    expect(screen.queryByText('Acesso autenticado')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mantém aprovação no RPC existente sem abrir dados reais de parceiro', async () => {
    mount()
    await screen.findByRole('heading', { name: 'Parceiro Sintético' })
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar parceiro' }))
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('admin_approve_partner', { p_partner_id: 'partner-1' }))
  })
})

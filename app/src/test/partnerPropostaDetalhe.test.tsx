import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    from: (table: string) => {
      const data = table === 'propostas' ? {
        id: 'proposal-1', protocolo: 'MC-TESTE-001', produto: 'home_equity', status: 'pre_analise',
        valor_solicitado: 400000, valor_imoveis_total: 1000000, prazo_meses: 120, carencia_meses: 3,
        taxa_juros_mensal: 1.29, amortizacao: 'price', correcao: 'pos_fixado', indexador: 'IPCA',
        created_at: '2026-10-21T12:00:00Z', updated_at: '2026-10-22T12:00:00Z',
        cliente: { id: 'client-1', data_nascimento: '1985-02-03', nome_completo: 'Cliente Partner', cpf: '12345678901', cnpj: null, email: 'cliente@example.invalid', email_responsavel: null, telefone: '11999990000', celular_comercial: null, modelo_renda: null, renda_mensal: null, endereco_cidade: 'São Paulo', endereco_estado: 'SP', razao_social: null, faturamento_mensal: null },
      } : table === 'proponentes' ? [{
        id: 'applicant-1', cliente_id: 'client-1', nome: 'Cliente Partner', cpf_cnpj: '12345678901', principal: true,
        relacao: null, estado_civil: 'casado', pessoa_tipo: 'PF', compoe_renda: true, modelo_renda: null,
        renda_mensal: 12000, endereco_cep: '01000-000', endereco_logradouro: 'Rua Exemplo', endereco_numero: '10',
        endereco_complemento: null, endereco_bairro: 'Centro', endereco_cidade: 'São Paulo', endereco_estado: 'SP',
      }] : []
      const result = { data, error: null }
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'order']) builder[method] = () => builder
      builder.single = () => Promise.resolve(result)
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return builder
    },
  },
}))
vi.mock('@/components/PropostaConsultas', () => ({ PropostaConsultas: () => <div>Consultas do cliente</div> }))

import { PartnerPropostaDetalhe } from '@/pages/partner/PropostaDetalhe'

afterEach(() => {
  cleanup()
  invoke.mockReset()
})

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/p/propostas/proposal-1']}>
        <Routes><Route path="/p/propostas/:id" element={<PartnerPropostaDetalhe />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('detalhe da proposta partner', () => {
  it('usa o cabeçalho e as abas compartilhados sem expor controles administrativos', async () => {
    mount()
    expect(await screen.findByRole('heading', { name: 'Cliente Partner' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(8)
    expect(document.querySelector('.proposal-status-strip--partner')).toHaveTextContent('R$ 400.000,00')
    expect(screen.queryByRole('tab', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alterar status' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Proponentes' }))
    expect(await screen.findByText('Proponentes da operação')).toBeInTheDocument()
    expect(screen.getByText('Rua Exemplo, 10')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver consultas' }))
    expect(screen.getByText('Consultas do cliente')).toBeInTheDocument()
  })

  it('mantém a reemissão de magic link e o estado de envio por e-mail', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://example.invalid/magic', email_status: 'enfileirado' }, error: null })
    mount()
    await screen.findByRole('heading', { name: 'Cliente Partner' })
    fireEvent.click(screen.getByRole('button', { name: 'Reemitir magic link' }))
    expect(await screen.findByText('E-mail de reemissão enfileirado para o cliente.')).toBeInTheDocument()
    expect(invoke).toHaveBeenCalledWith('magic-link-issue', { body: { proposta_id: 'proposal-1', send_email: true } })
    await waitFor(() => expect(screen.getByText('https://example.invalid/magic')).toBeInTheDocument())
  })
})

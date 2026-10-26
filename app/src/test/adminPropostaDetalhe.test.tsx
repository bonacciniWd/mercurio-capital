import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { AdminPropostaDetalhe } from '@/pages/admin/PropostaDetalhe'

const state = vi.hoisted(() => ({ legal: false }))
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ session: { role: 'admin', adminNivel: state.legal ? 'juridico' : 'master' } }) }))
vi.mock('@/components/PropostaFundos', () => ({ PropostaFundos: () => <div>Fundos vinculados</div> }))
vi.mock('@/components/PropostaConsultas', () => ({ PropostaConsultas: () => <div>Consultas autorizadas</div> }))
vi.mock('@/components/PropostaContrato', () => ({ PropostaContrato: () => <div>Contrato da operação</div> }))
vi.mock('@/components/PropostaPendencias', () => ({ PropostaPendencias: () => <div>Pendências da operação</div> }))
vi.mock('@/components/PropostaCondicaoComercial', () => ({ PropostaCondicaoComercial: () => <div>Condição comercial</div> }))
vi.mock('@/lib/supabase', () => ({ supabase: {
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  from: (table: string) => {
    const data = table === 'propostas' ? {
      id: 'test', protocolo: 'MC-TESTE', produto: 'home_equity', status: 'pre_analise', valor_solicitado: 400000,
      valor_imoveis_total: 1000000, prazo_meses: 120, carencia_meses: 0, taxa_juros_mensal: 1.29,
      amortizacao: 'price', indexador: 'IPCA', created_at: '2026-10-21T12:00:00Z', updated_at: '2026-10-21T12:00:00Z',
      cliente: { id: 'cliente-teste', nome_completo: 'Cliente Sintético', cpf: null, email: 'cliente@example.invalid' }, responsavel: null, partner: null,
    } : table === 'proponentes' ? [{ id: 'p', cliente_id: 'cliente-teste', nome: 'Cliente Sintético', principal: true, pessoa_tipo: 'PF', renda_mensal: null, endereco_logradouro: 'Rua de Teste', endereco_numero: '100', endereco_cidade: 'Cidade Exemplo', endereco_estado: 'SC' }] : []
    const result = { data, error: null }
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'in', 'order']) builder[method] = () => builder
    builder.single = () => Promise.resolve(result)
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return builder
  },
} }))
afterEach(() => { cleanup(); state.legal = false })
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/propostas/test']}><Routes><Route path="/admin/propostas/:id" element={<AdminPropostaDetalhe />} /></Routes></MemoryRouter></QueryClientProvider>)
}
describe('detalhe administrativo da proposta', () => {
  it('mostra dados reais e navega por teclado entre as nove abas', async () => {
    mount()
    await screen.findByText('Proposta MC-TESTE')
    expect(screen.getAllByRole('tab')).toHaveLength(9)
    const resumo = screen.getByRole('tab', { name: 'Resumo' })
    resumo.focus()
    fireEvent.keyDown(resumo, { key: 'ArrowRight' })
    const proponentes = screen.getByRole('tab', { name: 'Proponentes' })
    expect(proponentes).toHaveFocus()
    expect(proponentes).toHaveAttribute('aria-selected', 'true')
    const panel = screen.getByRole('tabpanel')
    await within(panel).findByText('Principal')
    expect(within(panel).getByText('Renda declarada').nextElementSibling).toHaveTextContent('—')
    expect(screen.queryByText('782')).not.toBeInTheDocument()
    expect(within(panel).getByText('cliente@example.invalid')).toBeInTheDocument()
    expect(within(panel).getByText('Rua de Teste, 100')).toBeInTheDocument()
    expect(within(panel).getByText('Sem score')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Ver consultas' }))
    expect(screen.getByText('Consultas autorizadas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Imóveis' }))
    await screen.findByText('Sem imóveis.')
    fireEvent.click(screen.getByRole('tab', { name: 'Consultas' }))
    expect(screen.getByText('Consultas autorizadas')).toBeInTheDocument()
  })
  it('mantém a alteração de status compacta e exige confirmação antes de enviar', async () => {
    mount()
    await screen.findByText('Proposta MC-TESTE')
    const trigger = screen.getByLabelText('Alterar status')
    const details = trigger.closest('details')!
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(trigger)
    expect(details).toHaveAttribute('open')
    const confirm = screen.getByRole('button', { name: 'Confirmar alteração' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Novo status'), { target: { value: 'analise_credito' } })
    fireEvent.change(screen.getByLabelText('Motivo / observação'), { target: { value: 'Teste sintético' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('admin_set_proposta_status', { p_id: 'test', p_status: 'analise_credito', p_motivo: 'Teste sintético' }))
    await waitFor(() => expect(details).not.toHaveAttribute('open'))
  })
  it('mantém o perfil jurídico sem controles de alteração de status e edição', async () => {
    state.legal = true
    mount()
    await screen.findByText('Proposta MC-TESTE')
    expect(screen.queryByText('Alterar status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar dados' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Não atribuído').length).toBeGreaterThan(0)
  })
})

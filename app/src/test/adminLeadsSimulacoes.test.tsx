import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLeadsSimulacoes } from '@/pages/admin/LeadsSimulacoes'
import { simulationLead, simulationLeadExamples } from './fixtures/simulacaoLeads'
import { type LeadRow } from '@/lib/simulacaoLeadPresentation'
import type { ReactElement, ReactNode } from 'react'

const mocks = vi.hoisted(() => ({ limit: vi.fn(), config: vi.fn(), rpc: vi.fn(), adminNivel: 'full' as 'full' | 'limitado' | 'juridico' }))
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ session: { role: 'admin', adminNivel: mocks.adminNivel } }) }))
// Isolate filter behavior from Radix positioning/animation in jsdom.
// The actual Popover, keyboard focus and calendar are checked together in Chrome.
vi.mock('@/components/ui/popover', async () => {
  const { createContext, useContext, cloneElement } = await import('react')
  const State = createContext({ open: false, onOpenChange: (_open: boolean) => {} })
  return {
    Popover: ({ children, ...state }: { children: ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => <State.Provider value={state}>{children}</State.Provider>,
    PopoverTrigger: ({ children }: { children: ReactElement }) => {
      const state = useContext(State)
      return cloneElement(children, { onClick: () => state.onOpenChange(!state.open) })
    },
    PopoverContent: ({ children, 'aria-label': label }: { children: ReactNode; 'aria-label': string }) => useContext(State).open ? <div role="dialog" aria-label={label}>{children}</div> : null,
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => table === 'v_admin_leads_publicos'
      ? { select: () => ({ order: () => ({ limit: mocks.limit }) }) }
      : { select: () => ({ eq: () => ({ maybeSingle: mocks.config }) }) },
  },
}))

beforeAll(() => {
  // jsdom lacks native dialog modality. Real focus/inert behavior is also checked in Chrome.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

beforeEach(() => {
  mocks.adminNivel = 'full'
  mocks.rpc.mockReset().mockResolvedValue({ data: [{ status_comercial: 'em_contato' }], error: null })
  mocks.limit.mockReset().mockResolvedValue({ data: simulationLeadExamples, error: null })
  mocks.config.mockReset().mockResolvedValue({ data: { fallback: 'Olá {{nome}}: {{tipo_calculadora}}, {{valor_simulado}}.', regras: [] }, error: null })
})
afterEach(cleanup)

function renderLeads(leads?: LeadRow[]) {
  if (leads) mocks.limit.mockResolvedValue({ data: leads, error: null })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><AdminLeadsSimulacoes /></QueryClientProvider>)
}

async function openLead(name: string) {
  const opener = await screen.findByRole('button', { name: `Ver detalhes de ${name}` })
  opener.focus()
  fireEvent.click(opener)
  return { opener, dialog: screen.getByRole('dialog') }
}

describe('leads do simulador — tabela e painel lateral', () => {
  it('apresenta localização, produto e volume sem inventar dados', async () => {
    renderLeads()
    await screen.findByText('Marina Exemplo')
    expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Lead', 'Localização', 'Produto', 'Volume potencial', 'Estado comercial', 'Estado do e-mail', 'Recebido', 'Ações'])
    expect(screen.getAllByText('Localização indisponível').length).toBeGreaterThan(0)
    expect(screen.queryByText('casa_condominio')).not.toBeInTheDocument()
    expect(mocks.limit).toHaveBeenCalledWith(500)
  })

  it('abre os planos, formata o imóvel e mantém foco no painel até fechar', async () => {
    renderLeads()
    const { opener, dialog } = await openLead(simulationLeadExamples[0].nome_completo)
    const close = within(dialog).getByRole('button', { name: 'Fechar detalhes' })
    expect(close).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    expect(within(dialog).getByText('Casa em condomínio')).toBeInTheDocument()
    expect(within(dialog).getByText('88338-270')).toBeInTheDocument()
    expect(within(dialog).getByText('07/10/2026')).toBeInTheDocument()
    expect(within(dialog).getByText('1,29% a.m.')).toBeInTheDocument()
    expect(within(dialog).getByText('Plano 1')).toBeInTheDocument()
    expect(within(dialog).getByText('Economia em juros')).toBeInTheDocument()
    const contact = within(dialog).getByRole('link', { name: 'Preparar contato no WhatsApp' })
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(contact).toHaveFocus()
    fireEvent.keyDown(contact, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('preserva página e filtros ao fechar por botão ou fundo, e volta à página 1 ao filtrar', async () => {
    renderLeads(Array.from({ length: 53 }, (_, i) => simulationLead({ id: `lead-${i}`, nome_completo: `Pessoa Exemplo ${i + 1}` })))
    await screen.findByText('Pessoa Exemplo 1')
    fireEvent.change(screen.getByLabelText('Buscar lead'), { target: { value: 'Exemplo' } })
    fireEvent.change(screen.getByLabelText('Estado do e-mail'), { target: { value: 'enviado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos os leads' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    const { dialog } = await openLead('Pessoa Exemplo 51')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar detalhes' }))
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar lead')).toHaveValue('Exemplo')
    expect(screen.getByLabelText('Estado do e-mail')).toHaveValue('enviado')
    fireEvent.click((await openLead('Pessoa Exemplo 51')).dialog)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar lead'), { target: { value: 'Pessoa Exemplo 1' } })
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument()
    expect(screen.getByText('Pessoa Exemplo 1')).toBeInTheDocument()
  })

  it('preserva o zero informado e distingue dados ausentes, plano vazio e resumo ausente', async () => {
    renderLeads([simulationLeadExamples[1]])
    const { dialog } = await openLead('Renato Exemplo')
    expect(within(dialog).getByText('Sala comercial')).toBeInTheDocument()
    expect(within(dialog).getByText(/R\$\s*0,00/)).toBeInTheDocument()
    expect(within(dialog).getByText('Última parcela').nextElementSibling).toHaveTextContent('Não informado')
    expect(within(dialog).getByText('Nenhum plano extra informado.')).toBeInTheDocument()
    expect(within(dialog).getByText('Comparativo não disponível neste registro.')).toBeInTheDocument()
  })

  it('usa mensagem parametrizada, impede WhatsApp inválido e filtra por status de qualquer destinatário', async () => {
    renderLeads()
    const contact = await screen.findByRole('link', { name: 'Preparar WhatsApp para Marina Exemplo' })
    const url = new URL(contact.getAttribute('href')!)
    expect(url.origin + url.pathname).toBe('https://wa.me/5511987654321')
    await waitFor(() => expect(new URL(contact.getAttribute('href')!).searchParams.get('text')).toMatch(/Olá Marina Exemplo: Home Equity, R\$\s350\.000,00\./))
    expect(contact).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('button', { name: 'WhatsApp indisponível para Contato Exemplo' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Estado do e-mail'), { target: { value: 'erro' } })
    expect(screen.getByText('Renato Exemplo')).toBeInTheDocument()
    expect(screen.queryByText('Marina Exemplo')).not.toBeInTheDocument()
  })

  it('permite limites de data independentes, apresenta dd/mm/aaaa e informa intervalo invertido', async () => {
    const today = new Date()
    const stamp = (day: number) => new Date(today.getFullYear(), today.getMonth(), day, 12).toISOString()
    renderLeads([simulationLead({ nome_completo: 'Antes do limite', created_at: stamp(14) }), simulationLead({ id: 'depois', nome_completo: 'Depois do limite', created_at: stamp(15) })])
    await screen.findByText('Antes do limite')
    fireEvent.click(screen.getByRole('button', { name: 'Recebido de: sem limite' }))
    fireEvent.click(screen.getByRole('button', { name: /15 de / }))
    expect(screen.queryByText('Antes do limite')).not.toBeInTheDocument()
    expect(screen.getByText('Depois do limite')).toBeInTheDocument()
    const dateText = `15/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    expect(screen.getByRole('button', { name: `Recebido de: ${dateText}` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Recebido até: sem limite' }))
    fireEvent.click(screen.getByRole('button', { name: /14 de / }))
    expect(screen.getByRole('alert')).toHaveTextContent('A data final deve ser igual ou posterior')
    fireEvent.click(screen.getByRole('button', { name: `Recebido de: ${dateText}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar data' }))
    expect(screen.getByText('Antes do limite')).toBeInTheDocument()
    expect(screen.queryByText('Depois do limite')).not.toBeInTheDocument()
  })

  it('mostra loading, erro e permite tentar carregar novamente', async () => {
    mocks.limit.mockResolvedValueOnce({ data: null, error: new Error('offline') })
    renderLeads()
    expect(screen.getByText('Carregando leads…')).toBeInTheDocument()
    await screen.findByText('Não foi possível carregar os leads internos.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Marina Exemplo')).toBeInTheDocument()
  })

  it('distingue a lista vazia da busca sem resultados', async () => {
    renderLeads([])
    await screen.findByText('Nenhum lead recebido')
    fireEvent.change(screen.getByLabelText('Buscar lead'), { target: { value: 'inexistente' } })
    expect(screen.getByText('Nenhum lead encontrado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Nenhum lead recebido')).toBeInTheDocument()
  })

  it('identifica CPC, não inventa valores financeiros e mostra os dados do projeto no painel', async () => {
    const cpcLead = simulationLead({
      id: 'cpc:lead-cpc', tipo_simulacao: 'cpc', nome_completo: 'Ana Projeto', email: 'ana@example.com',
      valor_credito: null, parcela_estimada: null, status_email_prospect: null, status_email_interno: null,
      fase_projeto: 'orcamento_cronograma', cidade: 'Balneário Camboriú', uf: 'SC',
      resumo_projeto: 'Construção de duas residências de alto padrão.', consentimento_versao: 'cpc_site_v1',
    })
    renderLeads([cpcLead])
    await screen.findByText('Ana Projeto')
    expect(screen.getByText('Crédito para Construção · CPC')).toBeInTheDocument()
    expect(screen.getByText('Orçamento e cronograma disponíveis')).toBeInTheDocument()
    expect(screen.getByText('Não aplicável')).toBeInTheDocument()
    expect(screen.queryByText(/R\$\s*0,00/)).not.toBeInTheDocument()

    const { dialog } = await openLead('Ana Projeto')
    expect(within(dialog).getByText('Projeto CPC')).toBeInTheDocument()
    expect(within(dialog).getByText('Construção de duas residências de alto padrão.')).toBeInTheDocument()
    expect(within(dialog).queryByText('Crédito simulado')).not.toBeInTheDocument()
    const contact = within(dialog).getByRole('link', { name: 'Preparar contato no WhatsApp' })
    expect(new URL(contact.getAttribute('href')!).searchParams.get('text')).toContain('Crédito para Construção (CPC)')
  })

  it('parte de Novo, grava mudança comercial via RPC e mantém o estado do e-mail separado', async () => {
    renderLeads()
    const select = await screen.findByLabelText('Estado comercial de Marina Exemplo')
    expect(select).toHaveValue('novo')
    fireEvent.change(select, { target: { value: 'em_contato' } })
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_set_lead_status_comercial', {
      p_lead_id: simulationLeadExamples.find(lead => lead.nome_completo === 'Marina Exemplo')!.id,
      p_novo_status: 'em_contato',
      p_status_esperado: 'novo',
    }))
    expect(screen.getByLabelText('Estado do e-mail')).toHaveValue('all')
  })

  it('mantém o estado anterior e pede revisão quando há conflito de edição', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'status_comercial_conflito' } })
    renderLeads()
    const select = await screen.findByLabelText('Estado comercial de Marina Exemplo')
    fireEvent.change(select, { target: { value: 'qualificado' } })
    expect(await screen.findByText(/O estado foi alterado por outra pessoa/)).toBeInTheDocument()
    expect(select).toHaveValue('novo')
  })

  it('bloqueia mudança comercial para admin jurídico e filtra por estado comercial', async () => {
    mocks.adminNivel = 'juridico'
    renderLeads([simulationLead({ id: 'a', nome_completo: 'Novo Exemplo' }), simulationLead({ id: 'b', nome_completo: 'Contato Exemplo', status_comercial: 'em_contato' })])
    const select = await screen.findByLabelText('Estado comercial de Novo Exemplo')
    expect(select).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Estado comercial'), { target: { value: 'em_contato' } })
    expect(screen.getByText('Contato Exemplo')).toBeInTheDocument()
    expect(screen.queryByText('Novo Exemplo')).not.toBeInTheDocument()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('abre o Brasil, expõe as 27 UFs e permite selecionar uma UF pelo mapa', async () => {
    renderLeads()
    await screen.findByText('Marina Exemplo')
    fireEvent.keyDown(screen.getByRole('button', { name: /^Brasil: 0 leads/ }), { key: 'Enter' })
    expect(screen.getByRole('group', { name: /Mapa do Brasil interativo/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^[A-Z]{2}: 0 leads$/ })).toHaveLength(27)
    fireEvent.keyDown(screen.getByRole('button', { name: 'SP: 0 leads' }), { key: 'Enter' })
    expect(screen.getByLabelText('Região')).toHaveValue('SP')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao mapa mundial' }))
    expect(screen.getByRole('group', { name: /Mapa mundial interativo/ })).toBeInTheDocument()
  })

  it('amplia e restaura o mapa por controle e roda', async () => {
    renderLeads()
    await screen.findByText('Marina Exemplo')
    const map = screen.getByRole('group', { name: /Mapa mundial interativo/ }) as unknown as SVGSVGElement
    const original = map.getAttribute('viewBox')
    fireEvent.click(screen.getByRole('button', { name: 'Aproximar mapa' }))
    expect(map.getAttribute('viewBox')).not.toBe(original)
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar mapa' }))
    expect(map.getAttribute('viewBox')).toBe(original)
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 400 } as DOMRect)
    fireEvent.wheel(map, { deltaY: -100, clientX: 400, clientY: 200 })
    expect(map.getAttribute('viewBox')).not.toBe(original)
  })
})

// Testes da UI do funil de prospecção (issue #34): board Kanban, card, modais de
// criação/detalhe, move otimista com rollback em 40001, conversão por nível e menu
// por nível. Hooks reais contra supabase mockado (testa a lógica otimista de verdade).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROSPECCAO_STATUS, PROSPECCAO_STATUS_LABEL } from '@/lib/prospeccao'
import type { ProspeccaoCard } from '@/hooks/useProspeccoes'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  cards: [] as ProspeccaoCard[],
  historico: [] as { id: string; status_anterior: string | null; status_novo: string; alterado_em: string; alterado_por: string | null }[],
  usuarios: [] as { id: string; nome_completo: string }[],
  anexosRows: [] as { prospeccao_id: string }[],
  anexosListar: [] as { id: string; nome: string; mime_type: string; tamanho_bytes: number; storage_path: string; created_at: string }[],
  adminNivel: 'full' as 'full' | 'limitado' | 'comercial' | 'juridico',
}))

function tableData(table: string): unknown[] {
  if (table === 'v_admin_prospeccoes_parceiro') return mocks.cards
  if (table === 'prospeccoes_parceiro_historico') return mocks.historico
  if (table === 'usuarios') return mocks.usuarios
  if (table === 'prospeccoes_parceiro_anexos') return mocks.anexosRows
  return []
}

// Builder thenable espelhando a fluidez do supabase-js (select/is/eq/in/order → await).
function makeChain(table: string) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'is', 'eq', 'in', 'order']) builder[m] = () => builder
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: tableData(table), error: null }).then(resolve, reject)
  return builder
}

function rpcDefault(name: string): Promise<{ data: unknown; error: unknown }> {
  if (name === 'admin_prospeccao_create') return Promise.resolve({ data: 'novo-id', error: null })
  if (name === 'admin_prospeccao_move') return Promise.resolve({ data: [{ status: 'follow_up' }], error: null })
  if (name === 'admin_prospeccao_anexos_listar') return Promise.resolve({ data: mocks.anexosListar, error: null })
  return Promise.resolve({ data: null, error: null })
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: unknown) => mocks.rpc(name, args),
    from: (table: string) => makeChain(table),
  },
}))

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { userId: 'u1', role: 'admin', adminNivel: mocks.adminNivel, nome: 'Admin Teste' },
    logout: vi.fn(),
  }),
}))

vi.mock('@/lib/prospeccaoAnexo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/prospeccaoAnexo')>('@/lib/prospeccaoAnexo')
  return {
    ...actual,
    createProspeccaoAnexoSignedUrl: vi.fn(async () => 'https://signed/print'),
    uploadProspeccaoAnexo: vi.fn(async () => 'anexo-novo'),
    openProspeccaoAnexo: vi.fn(),
  }
})

vi.mock('@/components/NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('@/components/PushOptIn', () => ({ PushOptIn: () => null }))

import { ProspeccaoKanban } from '@/components/ProspeccaoKanban'
import { AdminLayout } from '@/layouts/AdminLayout'

function renderComProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderBoard() {
  return renderComProviders(<ProspeccaoKanban />)
}

function makeCard(over: Partial<ProspeccaoCard> = {}): ProspeccaoCard {
  return {
    id: 'c1',
    nome_empresa: 'Imobiliária Alfa',
    contato_nome: 'Maria Souza',
    contato_email: 'maria@alfa.com',
    contato_telefone: '11999999999',
    origem: 'indicacao',
    notas: null,
    status: 'oportunidade',
    responsavel_id: 'u1',
    responsavel_nome: 'Carlos Admin',
    proxima_acao_em: null,
    partner_id: null,
    proposta_id: null,
    arquivado_em: null,
    motivo_arquivamento: null,
    created_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }
}

// Coluna do board pelo título (botão "Expandir etapa" do header bg-slate-950).
function coluna(label: string): HTMLElement {
  const titulo = screen.getAllByText(label).find(n => n.tagName === 'BUTTON' && n.getAttribute('title') === 'Expandir etapa')
  const col = titulo?.closest('.w-72')
  if (!col) throw new Error(`coluna "${label}" não encontrada`)
  return col as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.adminNivel = 'full'
  mocks.cards = []
  mocks.historico = []
  mocks.anexosRows = []
  mocks.anexosListar = []
  mocks.usuarios = [{ id: 'u1', nome_completo: 'Carlos Admin' }, { id: 'u2', nome_completo: 'Ana Comercial' }]
  mocks.rpc.mockImplementation((name: string) => rpcDefault(name))
})

afterEach(cleanup)

describe('Prospecção — board Kanban', () => {
  it('renderiza as 8 colunas na ordem fixa com os labels aprovados', async () => {
    mocks.cards = [makeCard()]
    renderBoard()
    await screen.findByText('Imobiliária Alfa')
    for (const status of PROSPECCAO_STATUS) {
      expect(coluna(PROSPECCAO_STATUS_LABEL[status])).toBeTruthy()
    }
    // ordem das colunas no DOM = ordem de PROSPECCAO_STATUS (títulos do header;
    // o botão "Expandir" também tem title="Expandir etapa" — filtrar só os títulos)
    const labels = PROSPECCAO_STATUS.map(s => PROSPECCAO_STATUS_LABEL[s])
    const headers = screen.getAllByTitle('Expandir etapa')
      .map(n => n.textContent)
      .filter((t): t is string => labels.includes(t ?? ''))
    expect(headers).toEqual(labels)
    // header da página + CTA
    expect(screen.getByRole('heading', { level: 1, name: 'Prospecção de parceiros' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nova oportunidade/ })).toBeInTheDocument()
    // coluna sem cards mostra o vazio de coluna
    expect(within(coluna('Follow Up')).getByText('Sem cards — arraste uma oportunidade para cá.')).toBeInTheDocument()
  })

  it('vazio global: ícone Target + textos + CTA', async () => {
    mocks.cards = []
    renderBoard()
    await screen.findByText('Nenhuma oportunidade ainda')
    expect(screen.getByText('Crie o primeiro card do funil para acompanhar a prospecção de parceiros.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Nova oportunidade/ }).length).toBeGreaterThan(0)
  })

  it('badge de follow-up: vencido (danger) / hoje (gold) / futuro (silver) / ausente (nada)', async () => {
    const agora = Date.now()
    mocks.cards = [
      makeCard({ id: 'c-venc', nome_empresa: 'Vencida SA', proxima_acao_em: new Date(agora - 3 * 86_400_000).toISOString() }),
      makeCard({ id: 'c-hoje', nome_empresa: 'Hoje LTDA', proxima_acao_em: new Date(agora).toISOString() }),
      makeCard({ id: 'c-fut', nome_empresa: 'Futura SA', proxima_acao_em: new Date(agora + 5 * 86_400_000).toISOString() }),
      makeCard({ id: 'c-sem', nome_empresa: 'Sem Data SA', proxima_acao_em: null, responsavel_id: null, responsavel_nome: null }),
    ]
    renderBoard()
    await screen.findByText('Vencida SA')
    expect(screen.getByText('Follow-up vencido há 3 dias')).toBeInTheDocument()
    expect(screen.getByText('Follow-up hoje')).toBeInTheDocument()
    expect(screen.getByText(/^Follow-up em \d{2} de \w{3}/)).toBeInTheDocument()
    // sem data → sem badge; sem responsável → fallback "Sem responsável"
    const cardSem = screen.getByText('Sem Data SA').closest('.card') as HTMLElement
    expect(within(cardSem).queryByText(/^Follow-up/)).toBeNull()
    expect(within(cardSem).getByText('Sem responsável')).toBeInTheDocument()
    // avatar com iniciais do responsável
    const cardVenc = screen.getByText('Vencida SA').closest('.card') as HTMLElement
    expect(within(cardVenc).getByLabelText('Responsável: Carlos Admin')).toHaveTextContent('CA')
    // chip de origem
    expect(within(cardVenc).getByText('Indicação')).toBeInTheDocument()
  })
})

describe('Prospecção — criação', () => {
  it('regra de canal inline: sem e-mail/telefone bloqueia; telefone vai só com dígitos', async () => {
    mocks.cards = [makeCard()]
    renderBoard()
    await screen.findByText('Imobiliária Alfa')

    fireEvent.click(screen.getByRole('button', { name: /Nova oportunidade/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/^Empresa/), { target: { value: 'Construtora Beta' } })
    fireEvent.change(within(dialog).getByLabelText(/^Nome do contato/), { target: { value: 'João Beta' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar oportunidade' }))
    expect(await within(dialog).findByText('Informe ao menos um canal: e-mail ou telefone.')).toBeInTheDocument()
    expect(mocks.rpc).not.toHaveBeenCalledWith('admin_prospeccao_create', expect.anything())

    fireEvent.change(within(dialog).getByLabelText(/^Telefone/), { target: { value: '11987654321' } })
    expect(within(dialog).getByLabelText(/^Telefone/)).toHaveValue('(11) 98765-4321')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar oportunidade' }))

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_prospeccao_create', expect.objectContaining({
      p_nome_empresa: 'Construtora Beta',
      p_contato_nome: 'João Beta',
      p_contato_telefone: '11987654321',
      p_contato_email: null,
      p_origem: 'outro',
    })))
    // sucesso: fecha o modal + banner aria-live "Oportunidade criada em Oportunidades."
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Oportunidade criada em Oportunidades.')).toBeInTheDocument()
  })
})

describe('Prospecção — move otimista', () => {
  it('menu "Mover para…" (caminho de teclado) move otimista e faz rollback no conflito 40001', async () => {
    mocks.cards = [makeCard({ id: 'c1', status: 'oportunidade' })]
    let resolveMove: (v: unknown) => void = () => {}
    mocks.rpc.mockImplementation((name: string) => {
      if (name === 'admin_prospeccao_move') return new Promise(resolve => { resolveMove = resolve })
      return rpcDefault(name)
    })
    renderBoard()
    await screen.findByText('Imobiliária Alfa')
    expect(within(coluna('Oportunidades')).getByText('Imobiliária Alfa')).toBeInTheDocument()

    // abre o menu "…" e move via teclado/clique (sem drag)
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Imobiliária Alfa' }))
    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Follow Up' }))

    // otimista: card aparece na coluna destino antes da resposta
    await within(coluna('Follow Up')).findByText('Imobiliária Alfa')
    expect(mocks.rpc).toHaveBeenCalledWith('admin_prospeccao_move', {
      p_id: 'c1', p_novo_status: 'follow_up', p_status_esperado: 'oportunidade',
    })

    // conflito 40001 → rollback + banner mapeado
    resolveMove({ data: null, error: { code: '40001', message: 'status_conflito' } })
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Outro membro da equipe moveu este card. O funil foi atualizado.')
    await waitFor(() => expect(within(coluna('Oportunidades')).getByText('Imobiliária Alfa')).toBeInTheDocument())
    expect(within(coluna('Follow Up')).queryByText('Imobiliária Alfa')).toBeNull()
  })

  it('menu lista os 8 destinos e desabilita a etapa atual', async () => {
    mocks.cards = [makeCard({ id: 'c1', status: 'follow_up' })]
    renderBoard()
    await screen.findByText('Imobiliária Alfa')
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Imobiliária Alfa' }))
    const menu = await screen.findByRole('menu')
    const itens = within(menu).getAllByRole('menuitem')
    expect(itens).toHaveLength(8)
    expect(within(menu).getByRole('menuitem', { name: /Follow Up/ })).toBeDisabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Ações de Imobiliária Alfa' })).toHaveFocus()
  })
})

describe('Prospecção — detalhe', () => {
  it('edição persiste via admin_prospeccao_update e confirma com "Alterações salvas."', async () => {
    mocks.cards = [makeCard({ id: 'c1' })]
    mocks.historico = [
      { id: 'h1', status_anterior: null, status_novo: 'oportunidade', alterado_em: new Date().toISOString(), alterado_por: null },
    ]
    renderBoard()
    await screen.findByText('Imobiliária Alfa')

    fireEvent.click(screen.getByRole('button', { name: 'Detalhes de Imobiliária Alfa' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Imobiliária Alfa' })).toBeInTheDocument()
    expect(within(dialog).getByText(/Criado em .* · Responsável: Carlos Admin/)).toBeInTheDocument()
    // histórico: criação do card
    await within(dialog).findByText(/criou o card em/)
    // salvar começa desabilitado (pristine)
    const salvar = within(dialog).getByRole('button', { name: 'Salvar alterações' })
    expect(salvar).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText(/^Empresa/), { target: { value: 'Imobiliária Alfa Prime' } })
    expect(salvar).toBeEnabled()
    fireEvent.click(salvar)

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_prospeccao_update', expect.objectContaining({
      p_id: 'c1',
      p_nome_empresa: 'Imobiliária Alfa Prime',
    })))
    await within(dialog).findByText('Alterações salvas.')
    // header reflete o novo nome
    expect(within(dialog).getByRole('heading', { name: 'Imobiliária Alfa Prime' })).toBeInTheDocument()
  })

  it('arquivar abre o ReasonDialog com os labels da spec', async () => {
    mocks.cards = [makeCard({ id: 'c1' })]
    renderBoard()
    await screen.findByText('Imobiliária Alfa')
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes de Imobiliária Alfa' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Arquivar' }))
    const reason = await screen.findByRole('dialog', { name: 'Arquivar oportunidade' })
    expect(within(reason).getByText('Motivo do arquivamento')).toBeInTheDocument()
    expect(within(reason).getByRole('button', { name: 'Arquivar' })).toBeInTheDocument()
  })
})

describe('Prospecção — conversão em proposta (só full/comercial)', () => {
  async function abrirDetalheConversao() {
    mocks.cards = [makeCard({ id: 'c-conv', status: 'converter_proposta' })]
    renderBoard()
    await screen.findByText('Imobiliária Alfa')
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes de Imobiliária Alfa' }))
    return screen.findByRole('dialog')
  }

  it('full: botão habilitado abre o diálogo "Converter em proposta?" e segue para o wizard', async () => {
    mocks.adminNivel = 'full'
    const dialog = await abrirDetalheConversao()
    const btn = within(dialog).getByRole('button', { name: 'Converter em proposta' })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Converter em proposta?')).toBeInTheDocument()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Continuar para a proposta' }))
    // modal fecha e o fluxo segue para o wizard admin com o contexto da prospecção
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('comercial: habilitado; limitado: desabilitado com title explicativo', async () => {
    mocks.adminNivel = 'comercial'
    let dialog = await abrirDetalheConversao()
    expect(within(dialog).getByRole('button', { name: 'Converter em proposta' })).toBeEnabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar detalhes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    cleanup()
    mocks.adminNivel = 'limitado'
    dialog = await abrirDetalheConversao()
    const btn = within(dialog).getByRole('button', { name: 'Converter em proposta' })
    expect(btn).toBeDisabled()
    expect(btn.closest('span')).toHaveAttribute('title', 'A conversão é executada por um admin full ou comercial.')
  })

  it('botão não aparece fora da etapa converter_proposta', async () => {
    mocks.adminNivel = 'full'
    mocks.cards = [makeCard({ id: 'c1', status: 'oportunidade' })]
    renderBoard()
    await screen.findByText('Imobiliária Alfa')
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes de Imobiliária Alfa' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Converter em proposta' })).toBeNull()
  })
})

describe('Menu admin por nível (S4)', () => {
  function LocationProbe() {
    const loc = useLocation()
    return <div data-testid="location">{loc.pathname}</div>
  }

  function renderMenu() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/admin/prospeccao']}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="prospeccao" element={<LocationProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('limitado vê Prospecção no menu; juridico não vê', () => {
    mocks.adminNivel = 'limitado'
    const { unmount } = renderMenu()
    expect(screen.getByRole('link', { name: 'Prospecção' })).toBeInTheDocument()
    unmount()

    mocks.adminNivel = 'juridico'
    renderMenu()
    expect(screen.queryByRole('link', { name: 'Prospecção' })).toBeNull()
  })
})

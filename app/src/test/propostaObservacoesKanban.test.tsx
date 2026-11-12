import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({
  criar: vi.fn(),
  editar: vi.fn(),
  remover: vi.fn(),
  uploadAnexo: vi.fn(),
  listarData: [] as unknown[],
  isLoading: false,
  isError: false,
}))

vi.mock('@/hooks/usePropostaObservacoes', () => ({
  usePropostaObservacoes: () => ({
    data: mocks.listarData,
    isLoading: mocks.isLoading,
    isError: mocks.isError,
    isSuccess: !mocks.isLoading && !mocks.isError,
    refetch: vi.fn(),
  }),
  useObservacaoCriar: () => ({ mutate: mocks.criar, isPending: false, isSuccess: false }),
  useObservacaoEditar: () => ({
    mutate: (vars: { id: string; corpo: string }, callbacks: { onSuccess: () => void; onError: (err: Error) => void }) =>
      mocks.editar(vars, callbacks),
    isPending: false,
  }),
  useObservacaoRemover: () => ({ mutate: mocks.remover, isPending: false, isError: false, reset: vi.fn() }),
}))
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ session: { userId: 'u1', role: 'partner' } }),
}))
vi.mock('@/lib/propostaObservacaoAnexo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/propostaObservacaoAnexo')>('@/lib/propostaObservacaoAnexo')
  return {
    ...actual,
    createObservacaoAnexoSignedUrl: vi.fn(async () => 'https://signed/x'),
    uploadObservacaoAnexo: (...args: unknown[]) => mocks.uploadAnexo(...args),
  }
})

import { ObservacoesKanbanContext } from '@/components/observacoesKanbanContext'
import { PropostaObservacoesButton } from '@/components/PropostaObservacoesButton'
import { PropostaObservacoesModal } from '@/components/PropostaObservacoesModal'

function renderComClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const OBS = {
  id: 'o1', autor_id: 'u1', autor_nome: 'Maria Silva', autor_papel: 'partner',
  corpo: 'Cliente mandou o print do erro.', etapa_snapshot: 'analise_credito',
  editado_em: null, created_at: new Date(Date.now() - 5 * 60_000).toISOString(), anexos: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listarData = []
  mocks.isLoading = false
  mocks.isError = false
})

describe('PropostaObservacoesButton', () => {
  it('badge só com contagem > 0; aria-label reflete o total', () => {
    const ctx = { contagem: {}, onOpen: vi.fn() }
    const { rerender } = render(
      <ObservacoesKanbanContext.Provider value={ctx}><PropostaObservacoesButton cardId="c1" /></ObservacoesKanbanContext.Provider>,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName('Observações da proposta (nenhuma registrada)')
    expect(screen.queryByText('0')).toBeNull()

    rerender(
      <ObservacoesKanbanContext.Provider value={{ contagem: { c1: 7 }, onOpen: vi.fn() }}>
        <PropostaObservacoesButton cardId="c1" />
      </ObservacoesKanbanContext.Provider>,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName('Observações da proposta (7)')
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('stopPropagation no pointerdown (preserva drag) e onClick abre', () => {
    const onOpen = vi.fn()
    render(
      <ObservacoesKanbanContext.Provider value={{ contagem: { c1: 2 }, onOpen }}>
        <PropostaObservacoesButton cardId="c1" />
      </ObservacoesKanbanContext.Provider>,
    )
    const btn = screen.getByRole('button')
    const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true }) // jsdom não tem PointerEvent; o type é o que importa
    const spy = vi.spyOn(event, 'stopPropagation')
    btn.dispatchEvent(event)
    expect(spy).toHaveBeenCalled()
    fireEvent.click(btn)
    expect(onOpen).toHaveBeenCalledWith('c1')
  })

  it('variant chip exibe rótulo "Observações" + badge; default kanban não muda', () => {
    render(
      <ObservacoesKanbanContext.Provider value={{ contagem: { c1: 3 }, onOpen: vi.fn() }}>
        <PropostaObservacoesButton cardId="c1" variant="chip" />
      </ObservacoesKanbanContext.Provider>,
    )
    const chip = screen.getByRole('button', { name: 'Observações da proposta (3)' })
    expect(chip).toHaveTextContent('Observações')
    expect(chip).toHaveTextContent('3')
    expect(chip.className).toContain('rounded-full')
  })

  it('não renderiza no DragOverlay (dragging) nem sem contexto', () => {
    const { container } = render(<PropostaObservacoesButton cardId="c1" />)
    expect(container).toBeEmptyDOMElement()
    const { container: c2 } = render(
      <ObservacoesKanbanContext.Provider value={{ contagem: {}, onOpen: vi.fn() }}>
        <PropostaObservacoesButton cardId="c1" dragging />
      </ObservacoesKanbanContext.Provider>,
    )
    expect(c2).toBeEmptyDOMElement()
  })
})

describe('PropostaObservacoesModal', () => {
  const proposta = { id: 'p1', protocolo: 'MERC-2026-000001', cliente_nome: 'João Cliente' }

  it('estado vazio com a cópia exata e composer presente', () => {
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    expect(screen.getByText('Nenhuma observação ainda.')).toBeInTheDocument()
    const composer = screen.getByPlaceholderText(/Escreva uma observação interna/)
    expect(composer).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull() // colapsado em repouso
    fireEvent.focus(composer) // expande ao foco (spec delta)
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled() // corpo vazio
  })

  it('timeline mostra autor, papel, chip de etapa, tempo e ações da janela (autor, 5 min)', () => {
    mocks.listarData = [OBS]
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText('Parceiro')).toBeInTheDocument()
    expect(screen.getByText('Análise Crédito')).toBeInTheDocument() // chip de etapa dentro do card do corpo
    const tempo = screen.getByText(/de \d{4},/) // ano corrente, sem hardcode
    expect(tempo).toBeInTheDocument() // timestamp absoluto visível (referência do dono)
    expect(tempo).toHaveAttribute('title', expect.stringContaining('há')) // relativo preservado no tooltip
    expect(screen.getByText(/Editável por mais \d+ min/)).toBeInTheDocument()
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeInTheDocument() // cópia da referência (era "Apagar")
  })

  it('ações somem fora da janela de 15 min', () => {
    mocks.listarData = [{ ...OBS, created_at: new Date(Date.now() - 20 * 60_000).toISOString() }]
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    expect(screen.queryByText('Editar')).toBeNull()
    expect(screen.queryByText(/Editável por mais/)).toBeNull()
  })

  it('ESC com composer sujo pede confirmação em vez de fechar', () => {
    const onClose = vi.fn()
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText(/Escreva uma observação interna/), { target: { value: 'rascunho' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText(/Descartar o rascunho/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Descartar rascunho'))
    expect(onClose).toHaveBeenCalled()
  })

  it('edição com erro do servidor fica aberta e mostra o erro no item (L3)', async () => {
    mocks.listarData = [OBS]
    mocks.editar.mockImplementation((_vars, callbacks) => callbacks.onError(new Error('A edição/remoção só é permitida nos primeiros 15 minutos.')))
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Editar'))
    fireEvent.change(screen.getByLabelText(/Editar observação de Maria Silva/), { target: { value: 'texto editado' } })
    fireEvent.click(screen.getByText('Salvar'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/15 minutos/))
    expect(screen.getByLabelText(/Editar observação de Maria Silva/)).toBeInTheDocument() // continua editando
  })

  it('publicar chama criar com corpo e anexos prontos', async () => {
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Escreva uma observação interna/), { target: { value: 'texto da obs' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(
      { corpo: 'texto da obs', anexoIds: [] },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    ))
  })

  it('anexo: falha de envio → "Tentar de novo" → anexado (retry da issue #23)', async () => {
    mocks.uploadAnexo
      .mockRejectedValueOnce(new Error('Falha ao enviar o print. Tente novamente.'))
      .mockResolvedValueOnce('anexo-1')
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    fireEvent.focus(screen.getByPlaceholderText(/Escreva uma observação interna/))

    const input = document.querySelector('input[type="file"]')!
    const file = new File(['img'], 'erro-cadastro.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('Tentar de novo')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Tentar de novo'))
    expect(await screen.findByText('Anexado')).toBeInTheDocument()
    expect(mocks.uploadAnexo).toHaveBeenCalledTimes(2)
    expect(mocks.uploadAnexo).toHaveBeenCalledWith('p1', file)
  })

  it('arquivo inválido entra como chip de erro SEM chamar upload (validação local)', async () => {
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    fireEvent.focus(screen.getByPlaceholderText(/Escreva uma observação interna/))
    const input = document.querySelector('input[type="file"]')!
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf', lastModified: 1763000000000 })
    fireEvent.change(input, { target: { files: [pdf] } })
    expect(await screen.findByText('doc.pdf')).toBeInTheDocument()
    expect(mocks.uploadAnexo).not.toHaveBeenCalled()
    // erro de validação é determinístico: sem "Tentar de novo" (L2)
    expect(screen.queryByText('Tentar de novo')).toBeNull()
    // re-selecionar o mesmo inválido não duplica o chip (L3)
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [pdf] } }) // mesmo arquivo (mesma key)
    expect(screen.getAllByText('doc.pdf')).toHaveLength(1)
    // remover o chip de erro limpa a lista
    fireEvent.click(screen.getByText('Remover'))
    await waitFor(() => expect(screen.queryByText('doc.pdf')).toBeNull())
  })

  it('retry → 2ª falha: chip volta a erro com a mensagem (Q3 da revisão #23)', async () => {
    mocks.uploadAnexo
      .mockRejectedValueOnce(new Error('Falha ao enviar o print. Tente novamente.'))
      .mockRejectedValueOnce(new Error('storage fora'))
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    fireEvent.focus(screen.getByPlaceholderText(/Escreva uma observação interna/))
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'print.png', { type: 'image/png' })] },
    })
    fireEvent.click(await screen.findByText('Tentar de novo'))
    // volta ao estado de erro, ainda com retry disponível
    expect(await screen.findByText('Tentar de novo')).toBeInTheDocument()
    expect(screen.getByText('Remover')).toBeInTheDocument()
    expect(mocks.uploadAnexo).toHaveBeenCalledTimes(2)
  })

  it('resolução tardia após unmount não ressuscita anexo nem quebra (Q3 da revisão #23)', async () => {
    let resolver!: (v: string) => void
    mocks.uploadAnexo.mockImplementation(() => new Promise<string>((r) => { resolver = r }))
    const { unmount } = renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    fireEvent.focus(screen.getByPlaceholderText(/Escreva uma observação interna/))
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'print.png', { type: 'image/png' })] },
    })
    expect(await screen.findByText('Enviando…')).toBeInTheDocument()
    unmount() // modal fechou com upload em voo
    resolver('anexo-tardio')
    await waitFor(() => expect(screen.queryByText('Anexado')).toBeNull())
    expect(mocks.criar).not.toHaveBeenCalled()
  })

  it('publicar vincula os IDs dos anexos prontos', async () => {
    mocks.uploadAnexo.mockResolvedValue('anexo-42')
    renderComClient(<PropostaObservacoesModal proposta={proposta} onClose={vi.fn()} />)
    fireEvent.focus(screen.getByPlaceholderText(/Escreva uma observação interna/))
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'print.png', { type: 'image/png' })] },
    })
    await screen.findByText('Anexado')
    fireEvent.change(screen.getByPlaceholderText(/Escreva uma observação interna/), { target: { value: 'com print' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(
      { corpo: 'com print', anexoIds: ['anexo-42'] },
      expect.anything(),
    ))
  })
})

// Testes do hook de dados das observações (issue #24 — lacuna L4 da revisão #21).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import {
  useObservacaoCriar,
  useObservacaoEditar,
  useObservacaoRemover,
  usePropostaObservacaoContagem,
  usePropostaObservacoes,
} from '@/hooks/usePropostaObservacoes'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('usePropostaObservacoes (timeline)', () => {
  it('chama a RPC de listagem e devolve as linhas', async () => {
    const linha = { id: 'o1', autor_id: 'u1', autor_nome: 'Maria', autor_papel: 'partner', corpo: 'x', etapa_snapshot: 'comite', editado_em: null, created_at: '2026-11-12T10:00:00Z', anexos: [] }
    mocks.rpc.mockResolvedValue({ data: [linha], error: null })
    const { result } = renderHook(() => usePropostaObservacoes('p1'), { wrapper: wrapper().wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.rpc).toHaveBeenCalledWith('proposta_observacoes_listar', { p_proposta_id: 'p1' })
    expect(result.current.data).toHaveLength(1)
  })

  it('fica desabilitada sem propostaId (não chama RPC)', () => {
    const { result } = renderHook(() => usePropostaObservacoes(null), { wrapper: wrapper().wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('erro da RPC vira mensagem mapeada em pt-BR', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'fora_do_escopo', code: '42501' } })
    const { result } = renderHook(() => usePropostaObservacoes('p9'), { wrapper: wrapper().wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/não tem acesso/i)
    expect((result.current.error as Error & { cause?: unknown }).cause).toBeTruthy()
  })
})

describe('usePropostaObservacaoContagem (badge em lote)', () => {
  it('ordena os ids na query key (cache estável) e devolve o mapa', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ proposta_id: 'p1', total: 4 }], error: null })
    const { result } = renderHook(() => usePropostaObservacaoContagem(['p2', 'p1']), { wrapper: wrapper().wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.rpc).toHaveBeenCalledWith('proposta_observacao_contagem', { p_proposta_ids: ['p1', 'p2'] })
    expect(result.current.data).toEqual({ p1: 4 })
  })

  it('lista vazia não chama RPC', () => {
    renderHook(() => usePropostaObservacaoContagem([]), { wrapper: wrapper().wrapper })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('mutations (criar/editar/remover) com invalidação', () => {
  it('criar chama RPC e invalida timeline + contagens', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    const { qc, wrapper: w } = wrapper()
    const spyTimeline = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useObservacaoCriar('p1'), { wrapper: w })
    await act(async () => {
      result.current.mutate({ corpo: 'texto', anexoIds: ['a1'] })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.rpc).toHaveBeenCalledWith('proposta_observacao_criar', {
      p_proposta_id: 'p1', p_corpo: 'texto', p_anexo_ids: ['a1'],
    })
    const keys = spyTimeline.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys.some((k) => k.includes('"p1"'))).toBe(true)
    expect(keys.some((k) => k.includes('contagem'))).toBe(true)
  })

  it('erro de janela expirada vira mensagem mapeada', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'janela_edicao_expirada' } })
    const { result } = renderHook(() => useObservacaoEditar('p1'), { wrapper: wrapper().wrapper })
    await act(async () => { result.current.mutate({ id: 'o1', corpo: 'tarde' }) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/15 minutos/)
  })

  it('remover passa o motivo (admin) à RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useObservacaoRemover('p1'), { wrapper: wrapper().wrapper })
    await act(async () => { result.current.mutate({ id: 'o1', motivo: 'print sensível' }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.rpc).toHaveBeenCalledWith('proposta_observacao_remover', { p_id: 'o1', p_motivo: 'print sensível' })
  })
})

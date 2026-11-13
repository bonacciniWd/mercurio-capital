// Contrato do caminho de conversão do funil (issue #34 / M1 do Revisor):
// o wizard admin com ?prospeccao=<id> submete via admin_prospeccao_converter.
// O wizard é multi-step; testamos o hook + o contrato de parâmetros (não o fluxo visual).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { useProspeccaoConverter } from '@/hooks/useProspeccoes'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('useProspeccaoConverter (contrato com admin_prospeccao_converter)', () => {
  it('chama a RPC com p_prospeccao_id, p_partner_id e p_payload, e devolve proposta_id/protocolo', async () => {
    mocks.rpc.mockResolvedValue({ data: { proposta_id: 'prop-9', protocolo: 'MERC-2026-000009' }, error: null })
    const { result } = renderHook(() => useProspeccaoConverter(), { wrapper: wrapper() })
    let out: { proposta_id: string } | undefined
    await act(async () => {
      out = await result.current.mutateAsync({
        id: 'prosp-1',
        partnerId: 'partner-1',
        payload: { cliente: { nome_completo: 'X' }, proponentes: [{}], imoveis: [{}] },
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.rpc).toHaveBeenCalledWith('admin_prospeccao_converter', {
      p_prospeccao_id: 'prosp-1',
      p_partner_id: 'partner-1',
      p_payload: { cliente: { nome_completo: 'X' }, proponentes: [{}], imoveis: [{}] },
    })
    expect(out?.proposta_id).toBe('prop-9')
  })

  it('mapeia 42501 (jurídico/limitado barrado pelo backend) para mensagem de permissão', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'forbidden' } })
    const { result } = renderHook(() => useProspeccaoConverter(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ id: 'p', partnerId: 'pt', payload: {} })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/não tem permissão/i)
  })

  it('mapeia "já convertida" e "fora da etapa" para mensagens amigáveis', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'prospeccao_ja_convertida' } })
    const { result } = renderHook(() => useProspeccaoConverter(), { wrapper: wrapper() })
    await act(async () => { result.current.mutate({ id: 'p', partnerId: 'pt', payload: {} }) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/já foi convertida/i)
  })

  it('invalida o board após conversão', async () => {
    mocks.rpc.mockResolvedValue({ data: { proposta_id: 'x', protocolo: null }, error: null })
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const w = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useProspeccaoConverter(), { wrapper: w })
    await act(async () => { await result.current.mutateAsync({ id: 'p', partnerId: 'pt', payload: {} }) })
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys.some((k) => k.includes('admin-prospeccoes'))).toBe(true)
  })
})

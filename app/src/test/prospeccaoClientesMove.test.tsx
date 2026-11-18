import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProspeccaoCliente } from '@/lib/prospeccaoCliente'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))
import { PROSPECCOES_CLIENTES_QUERY_KEY, useProspeccaoClienteMove } from '@/hooks/useProspeccoesClientes'

afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('movimento otimista B2C', () => {
  it('reverte a etapa e a nota de perda após conflito de outro operador', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const original = [{ id: 'prospect', status: 'novo', motivo_perda: null }] as ProspeccaoCliente[]
    client.setQueryData(PROSPECCOES_CLIENTES_QUERY_KEY, original)
    let finish!: (result: unknown) => void
    rpc.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { result } = renderHook(useProspeccaoClienteMove, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
    act(() => { result.current.mutate({ id: 'prospect', novo_status: 'perdido', status_esperado: 'novo', motivo_perda: 'Sem interesse' }) })
    await waitFor(() => expect(client.getQueryData<ProspeccaoCliente[]>(PROSPECCOES_CLIENTES_QUERY_KEY)?.[0]).toMatchObject({ status: 'perdido', motivo_perda: 'Sem interesse' }))
    act(() => { finish({ error: { code: '40001', message: 'status_desatualizado' } }) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData(PROSPECCOES_CLIENTES_QUERY_KEY)).toEqual(original)
    expect(client.getQueryState(PROSPECCOES_CLIENTES_QUERY_KEY)?.isInvalidated).toBe(true)
    client.clear()
  })
})

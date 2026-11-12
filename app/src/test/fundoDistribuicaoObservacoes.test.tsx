// Integração da issue #27: observações a partir da Distribuição por fundos.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ session: { userId: 'admin-1', role: 'admin' } }),
}))

const PROPOSTA_ROW = {
  proposta_id: 'p1',
  status_fundo: 'aguardando_analise',
  propostas: {
    id: 'p1', protocolo: 'MERC-2026-000236', produto: 'home_equity', status: 'pre_analise',
    valor_solicitado: 8_000_000, prazo_meses: 240, taxa_juros_mensal: 1.29,
    created_at: '2026-11-10T12:00:00-03:00',
    cliente: { nome_completo: 'Marcilene Evangelista Dimas', pessoa_tipo: 'PF', cpf: '07136271908', cnpj: null },
  },
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'admin_dashboard_fundos_analytics') {
        return {
          data: {
            fundos: [{
              fundo_id: 'f1', nome: 'BARI', cor_hex: '#c92f2a',
              operacoes_representadas: 1, operacoes_canceladas: 0, volume_cancelado: 0,
              operacoes_unicas: 1, volume_solicitado: 8_000_000, volume_ganho: 0,
            }],
            operacoes_sem_fundo_vencedor: 0, volume_solicitado_sem_fundo_vencedor: 0,
            operacoes_canceladas_sem_fundo_vencedor: 0, volume_cancelado_sem_fundo_vencedor: 0,
            operacoes_vencedor_em_outro_fundo: 0, volume_vencedor_em_outro_fundo: 0,
            operacoes_unicas: 1, operacoes_canceladas: 0, operacoes_ativas: 1, operacoes_standby: 0,
            volume_solicitado_unico: 8_000_000, volume_cancelado: 0, volume_ganho_unico: 0,
          },
          error: null,
        }
      }
      if (fn === 'proposta_observacao_contagem') {
        return { data: [{ proposta_id: 'p1', total: 2 }], error: null }
      }
      if (fn === 'proposta_observacoes_listar') return { data: [], error: null }
      return { data: null, error: null }
    }),
    from: vi.fn(() => {
      // distingue as 3 consultas pelo texto do select
      let page = { data: [] as unknown[], error: null, count: 0 }
      const c: Record<string, unknown> = {}
      const self = c as { then?: unknown }
      for (const m of ['eq', 'gte', 'lt', 'neq', 'not', 'in', 'order', 'range', 'limit', 'maybeSingle']) {
        c[m] = () => c
      }
      c.select = (cols: string) => {
        if (cols.includes('propostas!inner(id, protocolo')) page = { data: [PROPOSTA_ROW], error: null, count: 1 }
        else if (cols.includes('aprovado_em')) page = { data: [], error: null, count: 0 }
        else page = { data: [], error: null, count: 0 }
        return c
      }
      self.then = (resolve: (v: unknown) => unknown) => Promise.resolve(page).then(resolve)
      return c
    }),
  },
}))

import { FundoDistribuicaoCard } from '@/components/FundoDistribuicaoCard'

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FundoDistribuicaoCard inicio="2026-11-01" fim="2026-11-30" fundo="" partner="" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FundoDistribuicaoCard + observações (#27)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('linha da proposta exibe o chip Observações com o badge da contagem', async () => {
    renderCard()
    const chip = await screen.findByRole('button', { name: 'Observações da proposta (2)' }, { timeout: 5000 })
    expect(chip).toHaveTextContent('Observações')
    expect(chip).toHaveTextContent('2')
    expect(screen.getByText('Marcilene Evangelista Dimas')).toBeInTheDocument()
  })

  it('chip abre o modal com snapshot da linha (cliente + protocolo) e fecha devolvendo ao chip', async () => {
    renderCard()
    const chip = await screen.findByRole('button', { name: 'Observações da proposta (2)' }, { timeout: 5000 })
    fireEvent.click(chip)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Marcilene Evangelista Dimas')
    expect(dialog).toHaveTextContent('MERC-2026-000236')
    expect(dialog).toHaveTextContent('Visível apenas para a equipe e a operação.')
    expect(await screen.findByText('Nenhuma observação ainda.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar observações' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // foco retorna ao chip que abriu (data-obs-trigger)
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-obs-trigger', 'p1'))
  })
})

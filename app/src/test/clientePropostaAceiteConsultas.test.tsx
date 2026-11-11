import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useParams: () => ({ token: 'synthetic-invite-token' }),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } },
}))
vi.mock('@/components/Logo', () => ({ Logo: () => <span>Logo Mercúrio</span> }))

import { ClienteProposta } from '@/pages/public/ClienteProposta'

beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({
    data: {
      proposta_id: 'proposal-id', protocolo: 'MERC-2026-TEST', produto: 'home_equity',
      status: 'pre_analise', valor_solicitado: 100000, prazo_meses: 36,
      cliente_nome: 'Cliente Teste', cliente_email: 'cliente@example.test',
      expires_at: '2026-11-10T12:00:00.000Z',
    },
    error: null,
  })
  mocks.invoke.mockReset().mockResolvedValue({ data: null, error: new Error('synthetic failure') })
})

it('mantém a instrução web opcional desmarcada e informa a alternativa documental', async () => {
  render(<ClienteProposta />)

  const checkbox = await screen.findByRole('checkbox')
  expect(checkbox).not.toBeChecked()
  expect(screen.getByText(/Se deixar desmarcada, você poderá continuar/)).toBeTruthy()
})

it.each([
  ['aceita', true],
  ['recusa', false],
])('envia a escolha explícita de consulta quando o cliente %s', async (_label, accepts) => {
  render(<ClienteProposta />)

  const checkbox = await screen.findByRole('checkbox')
  if (accepts) fireEvent.click(checkbox)
  fireEvent.click(screen.getByRole('button', { name: /Entrar no portal/ }))

  await screen.findByText('Não foi possível iniciar a sessão do cliente. Solicite uma nova emissão do link.')
  expect(mocks.invoke).toHaveBeenCalledWith('magic-link-consume', {
    body: { token: 'synthetic-invite-token', aceite_consultas: accepts },
  })
})

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { MerxPublicaTab } from '@/components/admin/MerxPublicaTab'

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

afterEach(() => cleanup())

describe('configuração pública da MERX', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never)
  })

  it('mantém a FAQ padrão quando a RPC retorna uma lista vazia', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { habilitado: true, captacao_habilitada: false, faq: [] },
      error: null,
    } as never)

    render(<MerxPublicaTab />)

    expect(await screen.findByRole('button', { name: 'Adicionar pergunta' })).toBeEnabled()
    expect(screen.getAllByLabelText('Pergunta sugerida')[0]).toHaveValue('Oi / olá')
    expect(screen.getAllByLabelText('Pergunta sugerida')).toHaveLength(7)
  })

  it('mantém a FAQ padrão quando a propriedade FAQ está ausente', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { saudacao: 'Olá!' }, error: null } as never)
    render(<MerxPublicaTab />)
    expect((await screen.findAllByLabelText('Pergunta sugerida'))[0]).toHaveValue('Oi / olá')
    expect(screen.getAllByLabelText('Pergunta sugerida')).toHaveLength(7)
  })

  it('ignora itens de FAQ malformados e preserva os padrões', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { faq: [{ question: 'Inválida' }] }, error: null } as never)
    render(<MerxPublicaTab />)
    expect((await screen.findAllByLabelText('Pergunta sugerida'))[0]).toHaveValue('Oi / olá')
    expect(screen.getAllByLabelText('Pergunta sugerida')).toHaveLength(7)
  })

  it('carrega a FAQ configurada quando contém itens válidos', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        faq: [{ id: 'custom', question: 'Pergunta configurada?', answer: 'Resposta.', keywords: ['configurada'] }],
      },
      error: null,
    } as never)

    render(<MerxPublicaTab />)

    expect((await screen.findAllByLabelText('Pergunta sugerida'))[0]).toHaveValue('Pergunta configurada?')
    expect(screen.getAllByLabelText('Pergunta sugerida')).toHaveLength(1)
  })

  it('continua editável e mostra feedback quando a RPC retorna erro ou falha de rede', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Sem acesso' } } as never)
    render(<MerxPublicaTab />)
    expect(await screen.findByText('Sem acesso')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Pergunta sugerida')[0]).toHaveValue('Oi / olá')

    cleanup()
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('network'))
    render(<MerxPublicaTab />)
    expect(await screen.findByText('Não foi possível carregar a configuração da MERX pública.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar pergunta' })).toBeEnabled())
  })
})

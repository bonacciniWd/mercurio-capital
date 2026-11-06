import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MerxPublicChat } from '@/components/merx/MerxPublicChat'
import { supabase } from '@/lib/supabase'

const merxMocks = vi.hoisted(() => ({ loadRecaptchaV3: vi.fn(), executeRecaptchaV3: vi.fn(), invoke: vi.fn() }))

vi.mock('@/lib/recaptchaV3', () => merxMocks)

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    functions: { invoke: merxMocks.invoke },
  },
}))

describe('chat público MERX', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    merxMocks.invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null })
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        habilitado: true,
        captacao_habilitada: true,
        saudacao: 'Olá, como posso ajudar?',
      },
      error: null,
    } as never)
  })

  it('exibe a saudação publicada e não oferece controle Pause', async () => {
    render(<MerxPublicChat />)

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))

    expect(await screen.findByText('Olá, como posso ajudar?')).toBeInTheDocument()
    expect(screen.getByText(/Sou a MERX, assistente virtual da Mercúrio Capital/)).toBeInTheDocument()
    expect(screen.getByText('Como prefere que eu te chame?')).toBeInTheDocument()
    expect(document.querySelector('.merx-chat__brand-copy .merx-chat__wing')).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
    expect(document.querySelector('.merx-chat__brand-logo')).not.toBeInTheDocument()
    expect(document.querySelector('.merx-chat__launcher-logo svg')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
  })

  it('mantém as sugestões junto ao input, fora da área rolável', async () => {
    render(<MerxPublicChat />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem informar nome' }))
    fireEvent.click(screen.getByRole('button', { name: 'Busco crédito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Home Equity' }))

    const composer = screen.getByTestId('merx-chat-composer')
    const body = document.querySelector('.merx-chat__body')
    const suggestion = screen.getByRole('button', { name: 'Como funciona o Home Equity?' })
    const input = screen.getByRole('textbox', { name: 'Pergunte à MERX' })

    expect(composer).toContainElement(suggestion)
    expect(composer).toContainElement(input)
    expect(body).not.toContainElement(suggestion)
  })

  it('escreve progressivamente a resposta e anuncia o texto completo ao terminar', async () => {
    render(<MerxPublicChat />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Seu nome' }), { target: { value: 'Pessoa de Teste' } })
    fireEvent.submit(screen.getByRole('textbox', { name: 'Seu nome' }).closest('form')!)
    fireEvent.click(screen.getByRole('button', { name: 'Busco crédito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Home Equity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Como funciona o Home Equity?' }))

    expect(screen.getByRole('status')).toHaveTextContent('MERX está pensando')
    const answer = 'É uma operação de crédito com imóvel em garantia. O simulador público apresenta uma estimativa; as condições dependem da análise do perfil, do imóvel e da política vigente.'
    await waitFor(() => expect(document.querySelector('.merx-chat__message--merx.is-typing')).toBeInTheDocument())
    const answerBubble = document.querySelector('.merx-chat__message--merx.is-typing')

    expect(answerBubble?.textContent).not.toBe(answer)
    await waitFor(() => expect(answerBubble).toHaveTextContent(answer), { timeout: 5000 })
    expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')).toHaveTextContent(answer)
  }, 15000)

  it('mantém a FAQ acessível sem configuração e não libera captação', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'unavailable' } } as never)

    render(<MerxPublicChat />)

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))

    expect(await screen.findByText('Como posso ajudar?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Falar com a equipe' })).not.toBeInTheDocument()
  })

  it('oculta o chat quando a configuração publicada o desabilita explicitamente', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { habilitado: false, captacao_habilitada: false },
      error: null,
    } as never)

    render(<MerxPublicChat />)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Abrir MERX' })).not.toBeInTheDocument())
  })

  it('apresenta a mensagem enviada em um balão distinto e alinhado à direita', async () => {
    render(<MerxPublicChat />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))
    const input = screen.getByRole('textbox', { name: 'Seu nome' })
    fireEvent.change(input, { target: { value: 'Quero saber sobre crédito para construção.' } })
    fireEvent.submit(input.closest('form')!)

    const message = await screen.findByText('Quero saber sobre crédito para construção.')
    expect(message).toHaveClass('merx-chat__message--visitor')
  })

  it('orienta originadores, oferece cadastro e registra interesse de parceria opcionalmente', async () => {
    render(<MerxPublicChat />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Seu nome' }), { target: { value: 'Marina Exemplo' } })
    fireEvent.submit(screen.getByRole('textbox', { name: 'Seu nome' }).closest('form')!)
    await waitFor(() => expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')).toHaveTextContent('Prazer, Marina. Você é originador/parceiro ou está buscando crédito?'), { timeout: 6000 })
    fireEvent.click(screen.getByRole('button', { name: 'Sou originador / quero ser parceiro' }))

    await waitFor(() => expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')).toHaveTextContent(/organizarem oportunidades, criarem e acompanharem propostas/), { timeout: 6000 })
    expect(screen.getByRole('link', { name: 'Iniciar cadastro de parceiro' })).toHaveAttribute('href', '/p/registro')
    fireEvent.click(screen.getByRole('button', { name: 'Pedir contato sobre parceria' }))
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Marina Exemplo')
    expect(screen.getByLabelText('Assunto')).toHaveValue('parceiro_originador')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  }, 15000)

  it('responde ao cliente com o conteúdo público de construção e link correto', async () => {
    render(<MerxPublicChat />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem informar nome' }))
    fireEvent.click(screen.getByRole('button', { name: 'Busco crédito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crédito para Construção' }))

    await waitFor(() => expect(screen.getByText(/construtores e investidores que desenvolvem casas de alto padrão/)).toBeInTheDocument(), { timeout: 6000 })
    expect(screen.getByRole('link', { name: 'Conhecer Crédito para Construção' })).toHaveAttribute('href', '/credito-para-construcao')
    fireEvent.click(screen.getByRole('button', { name: 'Falar com a equipe' }))
    expect(screen.getByLabelText('Assunto')).toHaveValue('construcao')
  })

  it('valida o formato do e-mail e grava nome, cidade e telefone só após sucesso do servidor', async () => {
    merxMocks.loadRecaptchaV3.mockResolvedValue(undefined)
    merxMocks.executeRecaptchaV3.mockResolvedValue('captcha-token')
    vi.stubEnv('VITE_RECAPTCHA_SITEKEY', 'test-site-key')

    render(<MerxPublicChat />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir MERX' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Seu nome' }), { target: { value: 'Pessoa de Teste' } })
    fireEvent.submit(screen.getByRole('textbox', { name: 'Seu nome' }).closest('form')!)
    fireEvent.click(screen.getByRole('button', { name: 'Busco crédito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Home Equity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Falar com a equipe' }))
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Pessoa de Teste')
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Curitiba' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'invalido' } })
    fireEvent.change(screen.getByLabelText('Telefone com DDD'), { target: { value: '(41) 99999-0000' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar solicitação' }).closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('e-mail em formato válido')
    expect(merxMocks.invoke).not.toHaveBeenCalled()
    expect(screen.queryByText('Contato registrado. A equipe retornará pelos dados informados.')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'Pessoa@Exemplo.com' } })
    merxMocks.invoke
      .mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }) } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar solicitação' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas de envio')
    expect(merxMocks.invoke).toHaveBeenCalledOnce()
    const firstIdempotencyKey = merxMocks.invoke.mock.calls[0][1].body.idempotency_key
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar solicitação' }).closest('form')!)
    await waitFor(() => expect(screen.getByText('Contato registrado. A equipe retornará pelos dados informados.')).toBeInTheDocument(), { timeout: 5000 })
    expect(merxMocks.executeRecaptchaV3).toHaveBeenCalledWith('test-site-key', 'merx_lead_capture')
    expect(merxMocks.invoke).toHaveBeenCalledTimes(2)
    expect(merxMocks.invoke.mock.calls[0][0]).toBe('public-merx-lead')
    expect(merxMocks.invoke.mock.calls[1][1].body.idempotency_key).toBe(firstIdempotencyKey)
    const payload = merxMocks.invoke.mock.calls[0][1].body
    expect(payload).toMatchObject({ nome_completo: 'Pessoa de Teste', cidade: 'Curitiba', email: 'pessoa@exemplo.com', telefone: '(41) 99999-0000', interesse: 'home_equity', consentimento: true })
  })
})

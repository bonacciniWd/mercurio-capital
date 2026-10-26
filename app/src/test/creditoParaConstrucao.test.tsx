import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CreditoParaConstrucao } from '@/pages/CreditoParaConstrucao'
import { PoliticaPrivacidade } from '@/pages/public/PoliticaPrivacidade'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }))

beforeEach(() => invoke.mockReset())

describe('página pública de Crédito para Construção', () => {
  it('apresenta o conteúdo CPC e os atalhos para as seções', () => {
    render(<CreditoParaConstrucao />)

    expect(screen.getByRole('heading', { level: 1, name: /Crédito para construção de casas de alto padrão/i })).toBeInTheDocument()
    expect(screen.getByText('01 / A SOLUÇÃO')).toBeInTheDocument()
    expect(screen.getByText('04 / LIBERAÇÃO EM TRANCHES')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Solicitar avaliação do projeto/i })).toHaveAttribute('href', '#cpc-avaliacao')
    expect(screen.queryByText(/Protótipo institucional/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Solicitar análise do projeto/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('abre formulário CPC acessível e valida consentimento antes de enviar', () => {
    render(<CreditoParaConstrucao />)

    const question = screen.getByRole('button', { name: /O CPC é destinado a qualquer pessoa/i })
    expect(question).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(question)
    expect(question).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Cada solicitação depende da avaliação do perfil e do projeto/i)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Solicitar análise do projeto/i }))
    expect(screen.getByRole('heading', { name: 'Conte sobre o seu projeto' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/politica-de-privacidade')
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana Projeto' } })
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText(/Telefone com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/Fase atual do projeto/), { target: { value: 'projeto_aprovado' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar solicitação/i }))
    expect(screen.getByText(/consentimento é obrigatório/i)).toBeVisible()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('submete dados mínimos sem inventar valor financeiro e apresenta confirmação', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null })
    render(<CreditoParaConstrucao />)
    fireEvent.click(screen.getByRole('button', { name: /Solicitar análise do projeto/i }))
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana Projeto' } })
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText(/Telefone com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/Fase atual do projeto/), { target: { value: 'projeto_aprovado' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Enviar solicitação/i }))

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('public-cpc-lead', expect.objectContaining({
      body: expect.objectContaining({ nome_completo: 'Ana Projeto', email: 'ana@example.com', telefone: '47999998888', fase_projeto: 'projeto_aprovado', consentimento: true }),
    })))
    expect(await screen.findByRole('status')).toHaveTextContent(/Recebemos seu contato sobre o projeto CPC/i)
    expect(screen.queryByText(/valor de crédito/i)).not.toBeInTheDocument()
  })

  it('informa indisponibilidade de captura sem atribuí-la à revisão da política', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'capture_disabled' }), { status: 503 }) },
    })
    render(<CreditoParaConstrucao />)
    fireEvent.click(screen.getByRole('button', { name: /Solicitar análise do projeto/i }))
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana Projeto' } })
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText(/Telefone com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/Fase atual do projeto/), { target: { value: 'projeto_aprovado' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Enviar solicitação/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O recebimento deste formulário está temporariamente indisponível.')
    expect(screen.queryByText(/Política de Privacidade.*revisão|envio ficará disponível depois/i)).not.toBeInTheDocument()
  })

  it('apresenta a política pública aprovada com escopo, fatos operacionais e direitos dos titulares', () => {
    render(<MemoryRouter><PoliticaPrivacidade /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible()
    expect(screen.getByText(/Atualizada em 16 de outubro de 2026/i)).toBeVisible()
    expect(screen.queryByText(/Minuta 0\.2|Minuta em revisão interna|ainda precisa ser validada pela Mercúrio/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Crédito para Construção \(CPC\), Home Equity e Simulador de Amortização/i)).toBeVisible()
    expect(screen.getByRole('heading', { name: /Dados tratados nas propostas e áreas autenticadas/i })).toBeVisible()
    expect(screen.getByText(/CPF ou CNPJ, e-mail e telefone/i)).toBeVisible()
    expect(screen.getByRole('heading', { name: /Consultas e classificação operacional/i })).toBeVisible()
    expect(screen.getByText(/A classificação operacional não aprova nem recusa crédito/i)).toBeVisible()
    expect(screen.getByText(/classificador operacional baseado em regras do sistema/i)).toBeVisible()
    expect(screen.getByText(/casos de baixa confiança ou com sinal jurídico exigem revisão/i)).toBeVisible()
    const policyText = document.body.textContent ?? ''
    expect(policyText).toContain('64.382.034/0001-70')
    expect(policyText).toContain('Mercurio Capital Ltda.')
    expect(policyText).toContain('Rua 1301, 471, Centro, Balneário Camboriú/SC')
    expect(policyText).not.toMatch(/não confirma a atuação da Mercúrio como correspondente bancário/i)
    expect(policyText).not.toMatch(/razão social completa vinculada ao CNPJ ainda não está identificada/i)
    expect(policyText).not.toMatch(/retenção desses registros técnicos precisa ser confirmada/i)
    expect(policyText).not.toMatch(/não foi identificado nesta implementação o uso de IA generativa/i)
    expect(policyText).not.toMatch(/captura pública desse formulário depende de uma configuração/i)
    expect(screen.getByText(/mantidos pelo período necessário às finalidades informadas/i)).toBeVisible()
    expect(screen.getByText(/confirmação do tratamento e acesso aos dados/i)).toBeVisible()
    const privacyRequestLink = screen.getByRole('link', { name: 'Enviar solicitação por e-mail' })
    const privacyRequestHref = privacyRequestLink.getAttribute('href') ?? ''
    expect(privacyRequestHref).toMatch(/^mailto:contato@mercuriocapitalsa\.com\?subject=/)
    const decodedPrivacyRequest = decodeURIComponent(privacyRequestHref)
    expect(decodedPrivacyRequest).toContain('Solicitação sobre meus dados pessoais')
    expect(decodedPrivacyRequest).toContain('Nome completo:')
    expect(decodedPrivacyRequest).toContain('E-mail usado na interação:')
    expect(decodedPrivacyRequest).toContain('Descrição da solicitação:')
    expect(screen.getByText(/O site não envia a solicitação automaticamente/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /Voltar para Crédito para Construção/i })).toHaveAttribute('href', '/credito-para-construcao')
  })
})

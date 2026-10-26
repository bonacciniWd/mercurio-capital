import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PublicSimulator } from '@/components/PublicSimulator'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke } },
}))

function renderSimulator() {
  invoke.mockResolvedValue({ data: { ok: true, lead_id: 'lead-amortizacao' }, error: null })
  return render(<MemoryRouter><PublicSimulator /></MemoryRouter>)
}

describe('simulador público de amortização', () => {
  it('exige R$ 400.000 e aceita o valor mínimo exato', () => {
    renderSimulator()

    fireEvent.click(screen.getByRole('tab', { name: 'Amortização' }))
    const principalInput = screen.getByLabelText(/Valor do empréstimo/)
    fireEvent.change(principalInput, { target: { value: 'R$ 399.999,99' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('O valor mínimo do empréstimo é R$ 400.000,00.')
    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument()

    fireEvent.change(principalInput, { target: { value: 'R$ 400.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('captura o fluxo completo e envia os parâmetros SAC ao servidor', async () => {
    renderSimulator()

    fireEvent.click(screen.getByRole('tab', { name: 'Amortização' }))
    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument()
    expect(screen.getByLabelText(/Valor do empréstimo/)).toBeInTheDocument()
    expect(screen.getByLabelText('Data de início *')).toBeInTheDocument()
    expect(screen.getByLabelText('Sistema de amortização *')).toBeInTheDocument()
    expect(screen.getByLabelText('Taxa de juros (%) *')).toBeInTheDocument()
    expect(screen.getByLabelText('Periodicidade da taxa *')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantidade de parcelas *')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Sistema de amortização *'), { target: { value: 'sac' } })
    fireEvent.change(screen.getByLabelText('Quantidade de parcelas *'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/politica-de-privacidade')
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Maria da Silva' } })
    fireEvent.change(screen.getByLabelText(/Celular com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Apartamento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quitado' }))
    fireEvent.change(screen.getByLabelText(/CEP do imóvel/), { target: { value: '88330200' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Investir' }))
    fireEvent.click(screen.getByRole('button', { name: 'CLT' }))
    fireEvent.click(screen.getByRole('button', { name: 'Em até 1 mês' }))
    fireEvent.click(screen.getByRole('button', { name: /Ver minha simulação/ }))

    await waitFor(() => expect(screen.getByText('Simulação pronta para revisar')).toBeInTheDocument())
    expect(screen.getAllByText('Tabela SAC').length).toBeGreaterThan(0)
    expect(screen.getByText('Cronograma detalhado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Salvar como PDF/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Gráfico comparativo das parcelas/ })).not.toBeInTheDocument()
    expect(invoke).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Adicionar plano/ }))
    const dialog = screen.getByRole('dialog')
    expect(screen.queryByRole('button', { name: /Salvar como PDF/ })).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Valor da amortização/), { target: { value: '1000000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mensal' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar plano' }))
    expect(screen.getByText(/Plano 1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar como PDF/ })).toBeInTheDocument()
    const printDocument = document.body.querySelector('.print-document')
    expect(printDocument).toBeInTheDocument()
    expect(printDocument?.querySelector('svg[aria-label="Gráfico comparativo das parcelas sem e com amortização extra"]')).toBeInTheDocument()
    expect(printDocument?.querySelectorAll('table')).toHaveLength(2)
    const summary = screen.getByText(/Com os planos configurados/)
    expect(summary).toHaveTextContent('você amortizará um total extra de R$ 100.000,00')
    expect(summary).toHaveTextContent('prazo estimado será de 11 meses, com redução de 1 mês')
    expect(summary).not.toHaveTextContent('pagamento total estimado cai')
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const editDialog = screen.getByRole('dialog')
    const reduceInstallment = within(editDialog).getByRole('button', { name: 'Reduzir parcela' })
    fireEvent.click(reduceInstallment)
    expect(reduceInstallment).toHaveAttribute('aria-pressed', 'true')
    expect(reduceInstallment).toHaveClass('btn-no-liquid', 'bg-red-600', 'text-white')
    expect(within(editDialog).getByRole('button', { name: 'Mensal' })).toHaveClass('btn-no-liquid', 'bg-red-600')
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Salvar plano' }))
    expect(screen.getByText(/Com os planos configurados/)).toHaveTextContent('mantendo o prazo original')
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reduzir prazo' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar plano' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Com amortização' }))
    expect(screen.getByRole('tab', { name: 'Com amortização' })).toHaveClass('btn-no-liquid', 'bg-red-600', 'text-white')
    fireEvent.click(screen.getByRole('button', { name: 'Remover plano 1' }))
    expect(screen.queryByRole('button', { name: /Salvar como PDF/ })).not.toBeInTheDocument()
    expect(document.body.querySelector('.print-document')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar plano/ }))
    const replacementDialog = screen.getByRole('dialog')
    fireEvent.change(within(replacementDialog).getByLabelText(/Valor da amortização/), { target: { value: '1000000' } })
    fireEvent.click(within(replacementDialog).getByRole('button', { name: 'Mensal' }))
    fireEvent.click(within(replacementDialog).getByRole('button', { name: 'Salvar plano' }))
    expect(screen.getByRole('button', { name: /Salvar como PDF/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Salvar simulação e receber resultado/ }))

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1))
    expect(invoke).toHaveBeenCalledWith('public-simulacao-lead', expect.objectContaining({
      body: expect.objectContaining({
        tipo_simulacao: 'amortizacao',
        sistema_amortizacao: 'sac',
        quantidade_parcelas: 12,
        nome_completo: 'Maria da Silva',
        planos_amortizacao: [{ valor_extra: 10_000, objetivo: 'prazo', frequencia: 'mensal', apos_parcela: 1 }],
      }),
    }))
  })

  it('exige consentimento antes de avançar no contato', () => {
    renderSimulator()
    fireEvent.click(screen.getByRole('tab', { name: 'Amortização' }))
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Maria da Silva' } })
    fireEvent.change(screen.getByLabelText(/Celular com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Aceite o uso dos dados')
  })
})

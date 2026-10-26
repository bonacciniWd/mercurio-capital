import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PublicSimulator } from '@/components/PublicSimulator'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
    },
  },
}))

function renderSimulator() {
  return render(
    <MemoryRouter>
      <PublicSimulator />
    </MemoryRouter>,
  )
}

describe('simulador público', () => {
  it('percorre as quatro etapas e mostra o resultado estimado', async () => {
    renderSimulator()

    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/politica-de-privacidade')

    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Maria da Silva' } })
    fireEvent.change(screen.getByLabelText(/Celular com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText('Passo 3 de 4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Apartamento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quitado' }))
    fireEvent.change(screen.getByLabelText(/CEP do imóvel/), { target: { value: '88330200' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.getByText('Passo 4 de 4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Investir' }))
    fireEvent.click(screen.getByRole('button', { name: 'CLT' }))
    fireEvent.click(screen.getByRole('button', { name: 'Em até 1 mês' }))
    fireEvent.click(screen.getByRole('button', { name: /Ver minha simulação/ }))

    await waitFor(() => expect(screen.getByText('Simulação concluída')).toBeInTheDocument())
    expect(screen.getByText('Olá, Maria.')).toBeInTheDocument()
    expect(screen.getByText('Parcela estimada')).toBeInTheDocument()
  })

  it('impede avançar quando o consentimento de contato não foi marcado', () => {
    renderSimulator()
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Maria da Silva' } })
    fireEvent.change(screen.getByLabelText(/Celular com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('Aceite o uso dos dados')
    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument()
  })

  it('bloqueia crédito abaixo de R$ 400.000 no campo de operação', () => {
    const invoke = vi.mocked(supabase.functions.invoke)
    invoke.mockClear()
    renderSimulator()

    const creditInput = screen.getByLabelText('Ou informe o valor')
    fireEvent.change(creditInput, { target: { value: 'R$ 399.999,99' } })
    expect((creditInput as HTMLInputElement).value.replace(/\u00a0/g, ' ')).toBe('R$ 400.000,00')
    expect(screen.getAllByText(/R\$\s400\.000,00/).length).toBeGreaterThan(0)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('bloqueia imóvel comercial que não suporta o crédito mínimo pelo LTV', () => {
    const invoke = vi.mocked(supabase.functions.invoke)
    invoke.mockClear()
    renderSimulator()

    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Wilson da Silva' } })
    fireEvent.change(screen.getByLabelText(/Celular com DDD/), { target: { value: '47999998888' } })
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'wilson@example.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Sala comercial' }))
    expect(screen.getByText(/este imóvel precisa valer pelo menos R\$ 1\.000\.000,00\. O limite atual é R\$ 340\.000,00/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quitado' }))
    fireEvent.change(screen.getByLabelText(/CEP do imóvel/), { target: { value: '88330200' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))

    expect(screen.getByRole('alert')).toHaveTextContent(/simular a partir de R\$ 400\.000,00/)
    expect(screen.getByRole('alert')).toHaveTextContent(/pelo menos R\$ 1\.000\.000,00/)
    expect(screen.getByText('Passo 3 de 4')).toBeInTheDocument()
    expect(invoke).not.toHaveBeenCalled()
  })
})

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SimulacaoCreditoPdf } from '@/components/SimulacaoCreditoPdf'

describe('documento PDF de prévia de crédito', () => {
  it('mostra os valores calculados, o cronograma e o aviso de encargos pendentes', () => {
    render(<SimulacaoCreditoPdf
      values={{
        valor_solicitado: 500_000,
        valor_garantia: 1_000_000,
        taxa_juros_mensal: 1.29,
        prazo_meses: 12,
        carencia_meses: 0,
        correcao: 'pos_fixado',
        amortizacao: 'price',
      }}
      produto="Home Equity"
      pessoaTipo="PF"
    />)

    const document = window.document.querySelector('.simulation-print-document')
    expect(document?.querySelector('h1')?.textContent).toBe('Prévia da simulação de crédito')
    expect(document?.textContent).toContain('IOF, tarifa de registro, TAC, seguros MIP/DFI')
    expect(document?.textContent).toContain('IOF, TAC, registro e seguros: não calculados — aguardando validação financeira.')
    expect(document?.textContent).toContain('LTV estimado')
    expect(document?.querySelectorAll('tbody tr')).toHaveLength(12)
  })
})

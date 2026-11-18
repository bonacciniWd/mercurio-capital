import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchablePartnerSelect, type PartnerSelectOption } from '@/components/SearchablePartnerSelect'

const options: PartnerSelectOption[] = [
  { partner_id: 'p-1', nome: 'Ana Parceira', email: 'ana@example.com', status: 'approved' },
  { partner_id: 'p-2', nome: 'Bruno Parceiro', email: 'bruno@example.com', status: 'pending' },
]

describe('SearchablePartnerSelect', () => {
  it('filtra por nome/e-mail e seleciona com teclado', () => {
    const onChange = vi.fn()
    render(<SearchablePartnerSelect options={options} value="" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Buscar parceiro por nome ou e-mail' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'bruno@' } })
    expect(screen.getByRole('option', { name: /Bruno Parceiro/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ana Parceira/ })).not.toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('p-2')
  })

  it('expõe estado sem resultados e conserva a seleção visível quando fechado', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SearchablePartnerSelect options={options} value="p-1" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Buscar parceiro por nome ou e-mail' })
    expect(input).toHaveValue('Ana Parceira')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sem correspondência' } })
    expect(within(screen.getByRole('listbox')).getByText('Nenhum parceiro corresponde à busca.')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    rerender(<SearchablePartnerSelect options={options} value="p-1" onChange={onChange} />)
    expect(screen.getByRole('combobox', { name: 'Buscar parceiro por nome ou e-mail' })).toHaveValue('Ana Parceira')
  })
})

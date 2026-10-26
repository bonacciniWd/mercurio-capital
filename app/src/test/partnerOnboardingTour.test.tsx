import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PartnerOnboardingTour } from '@/components/PartnerOnboardingTour'

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ session: { userId: 'partner-one', role: 'partner' } }) }))

beforeEach(() => {
  localStorage.clear()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

describe('guia do parceiro', () => {
  it('permite pausar, retomar e concluir sem criar proposta', async () => {
    const { unmount } = render(<MemoryRouter><PartnerOnboardingTour /></MemoryRouter>)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }))
    expect(screen.getByRole('heading', { name: 'Simule antes de propor' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar depois' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(<MemoryRouter><PartnerOnboardingTour /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Simule antes de propor' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '6. MERX' }))
    expect(screen.getByText(/assistente por usuário e proposta está planejado/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir guia' }))
    expect(localStorage.getItem('mercurio:partner_tour_v2:partner-one')).toBe('completed')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReasonDialog } from '@/components/ui/reason-dialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof ReasonDialog>> = {}) {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  render(
    <ReasonDialog
      open
      title="Reabrir competência"
      description="A reabertura ficará registrada na auditoria."
      context="Competência: agosto de 2026"
      confirmLabel="Confirmar reabertura"
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onClose, onConfirm }
}

describe('ReasonDialog', () => {
  it('bloqueia justificativa curta e envia o motivo normalizado', () => {
    const { onConfirm } = renderDialog()
    const field = screen.getByRole('textbox', { name: 'Motivo da reabertura' })

    fireEvent.change(field, { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reabertura' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Informe ao menos 5 caracteres.')).toBeInTheDocument()

    fireEvent.change(field, { target: { value: '  Ajuste contábil do período  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reabertura' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledWith('Ajuste contábil do período')
  })

  it('permite cancelar por Escape quando não está enviando', () => {
    const { onClose } = renderDialog()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('mantém o modal bloqueado e apresenta erro durante uma falha da RPC', () => {
    const { onClose } = renderDialog({ pending: true, serverError: 'Falha ao reabrir a competência.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao reabrir a competência.')
    expect(screen.getByRole('button', { name: 'Reabrindo...' })).toBeDisabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

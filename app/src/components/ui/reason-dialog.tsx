import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { Button } from './button'

interface ReasonDialogProps {
  open: boolean
  title: string
  description: string
  context?: string
  confirmLabel: string
  pending?: boolean
  serverError?: string | null
  minLength?: number
  /** Aditivo (issue #22): labels customizáveis; defaults = comportamento atual. */
  reasonLabel?: string
  reasonPlaceholder?: string
  pendingLabel?: string
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function ReasonDialog({
  open,
  title,
  description,
  context,
  confirmLabel,
  pending = false,
  serverError,
  minLength = 5,
  reasonLabel = 'Motivo da reabertura',
  reasonPlaceholder = 'Descreva por que esta competência precisa ser reaberta.',
  pendingLabel = 'Reabrindo...',
  onClose,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const openerRef = useRef<Element | null>(null)
  const pendingRef = useRef(pending)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()
  const trimmedReason = reason.trim()
  const invalid = attempted && trimmedReason.length < minLength

  useEffect(() => {
    pendingRef.current = pending
    onCloseRef.current = onClose
  }, [pending, onClose])

  useEffect(() => {
    if (!open) return
    setReason('')
    setAttempted(false)
    openerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      // focus trap (issue #22 — diálogo pode abrir por cima de outro modal)
      if (event.key !== 'Tab' || !panelRef.current) return
      const focaveis = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled):not([type="file"]):not([hidden]), [tabindex]:not([tabindex="-1"]), a[href]',
      )
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus()
    }
  }, [open])

  if (!open) return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (trimmedReason.length < minLength || pending) return
    onConfirm(trimmedReason)
  }

  function close() {
    if (!pending) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-silver-950/55 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-silver-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-silver-100 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-silver-900">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-silver-500">{description}</p>
          </div>
          <button type="button" className="btn-no-liquid -mr-2 rounded-md p-2 text-silver-500 hover:bg-silver-100" onClick={close} aria-label="Fechar" disabled={pending}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-4 px-6 py-5">
            {context && <div className="rounded-lg border border-silver-200 bg-silver-50 px-4 py-3 text-sm text-silver-700">{context}</div>}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-silver-600">{reasonLabel}</span>
              <textarea
                ref={textareaRef}
                value={reason}
                onChange={event => setReason(event.target.value)}
                className="input min-h-28 resize-y py-3"
                placeholder={reasonPlaceholder}
                maxLength={500}
                disabled={pending}
                aria-invalid={invalid}
                aria-describedby={`${descriptionId}-validation`}
              />
            </label>
            <div id={`${descriptionId}-validation`} className="flex items-start justify-between gap-3 text-xs">
              <p className={invalid ? 'flex items-center gap-1.5 text-danger' : 'text-silver-500'}>
                {invalid && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                {invalid ? `Informe ao menos ${minLength} caracteres.` : `Mínimo de ${minLength} caracteres. A justificativa ficará registrada na auditoria.`}
              </p>
              <span className="shrink-0 tabular-nums text-silver-400">{reason.length}/500</span>
            </div>
            {serverError && (
              <div className="flex gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {serverError}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-silver-100 bg-silver-50 px-6 py-4">
            <Button type="button" variant="outline" onClick={close} disabled={pending}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

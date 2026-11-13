// Modal de criação de oportunidade do funil de prospecção (issue #34 — spec UX/UI).
// Formulário mínimo: responsável NÃO aparece (backend usa auth.uid()); regra de
// canal inline (e-mail ou telefone); shell a11y do PropostaObservacoesModal
// (foco inicial no X, focus trap, ESC, retorno de foco, guarda de rascunho).
import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PROSPECCAO_ORIGEM, PROSPECCAO_ORIGEM_LABEL,
  prospeccaoTelefoneDigits, prospeccaoTelefoneDisplay,
  type ProspeccaoOrigem,
} from '@/lib/prospeccao'
import { isValidEmailFormat } from '@/lib/emailValidation'
import { useProspeccaoCreate } from '@/hooks/useProspeccoes'

type FormState = {
  nome_empresa: string
  contato_nome: string
  contato_email: string
  contato_telefone: string
  origem: ProspeccaoOrigem
  proxima_acao_em: string
  notas: string
}

const initialForm: FormState = {
  nome_empresa: '',
  contato_nome: '',
  contato_email: '',
  contato_telefone: '',
  origem: 'outro',
  proxima_acao_em: '',
  notas: '',
}

export function ProspeccaoCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createMut = useProspeccaoCreate()
  const tituloId = useId()
  const subId = useId()
  const campoId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const openerRef = useRef<Element | null>(null)
  const pendenteRef = useRef(false)

  const [form, setForm] = useState<FormState>(initialForm)
  const [tentou, setTentou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)

  const email = form.contato_email.trim()
  const telDigits = prospeccaoTelefoneDigits(form.contato_telefone)
  const canalOk = email !== '' || telDigits.length > 0
  const emailOk = email === '' || isValidEmailFormat(email)
  const valido = form.nome_empresa.trim().length >= 2 && form.contato_nome.trim().length >= 3 && canalOk && emailOk
  const sujo = form.nome_empresa !== '' || form.contato_nome !== '' || form.contato_email !== ''
    || form.contato_telefone !== '' || form.notas !== '' || form.proxima_acao_em !== ''
  const pendente = createMut.isPending

  useEffect(() => {
    pendenteRef.current = pendente
  }, [pendente])

  // foco inicial no X + captura do elemento que abriu (para devolver o foco)
  useEffect(() => {
    openerRef.current = document.activeElement
    const t = window.setTimeout(() => closeRef.current?.focus(), 0)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      const abridor = openerRef.current
      if (abridor instanceof HTMLElement && abridor !== document.body && document.contains(abridor)) abridor.focus()
    }
  }, [])

  function pedirFechar() {
    if (pendenteRef.current) return
    if (sujo && !confirmarDescarte) {
      setConfirmarDescarte(true)
      return
    }
    onClose()
  }

  // ESC + trap de foco
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        pedirFechar()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focaveis = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled):not([type="file"]):not([hidden]), select:not(:disabled), [tabindex]:not([tabindex="-1"]), a[href]',
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
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  function patch<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(current => ({ ...current, [field]: value }))
    setErro(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTentou(true)
    if (!valido || pendente) return
    setErro(null)
    createMut.mutate(
      {
        nome_empresa: form.nome_empresa.trim(),
        contato_nome: form.contato_nome.trim(),
        contato_email: email || null,
        contato_telefone: telDigits || null,
        origem: form.origem,
        notas: form.notas.trim() || null,
        proxima_acao_em: form.proxima_acao_em ? new Date(`${form.proxima_acao_em}T12:00:00`).toISOString() : null,
      },
      {
        onSuccess: () => onCreated(),
        onError: (err) => setErro(err.message),
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-silver-950/55 backdrop-blur-[1px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) pedirFechar()
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={subId}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-silver-200 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-silver-100 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Funil de prospecção</p>
            <h2 id={tituloId} className="mt-0.5 text-lg font-bold text-slate-950">Nova oportunidade</h2>
            <p id={subId} className="mt-0.5 text-xs text-silver-500">O card entra na coluna Oportunidades com você como responsável.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={pedirFechar}
            aria-label="Fechar"
            className="btn-no-liquid -mr-2 shrink-0 rounded-md p-2 text-silver-500 hover:bg-silver-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {confirmarDescarte && (
          <div className="shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2 sm:px-6" role="alert">
            <div className="flex flex-col gap-2 text-xs text-silver-800 sm:flex-row sm:items-center sm:justify-between">
              <span>Descartar o rascunho? Os dados preenchidos serão perdidos.</span>
              <span className="flex gap-2">
                <button type="button" className="btn-no-liquid font-semibold text-silver-700" onClick={() => setConfirmarDescarte(false)}>
                  Continuar editando
                </button>
                <button type="button" className="btn-no-liquid font-semibold text-danger" onClick={onClose}>
                  Descartar rascunho
                </button>
              </span>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div>
              <label className="label" htmlFor={`${campoId}-empresa`}>Empresa *</label>
              <input
                id={`${campoId}-empresa`}
                className="input"
                value={form.nome_empresa}
                onChange={event => patch('nome_empresa', event.target.value)}
                maxLength={160}
                autoComplete="organization"
                aria-invalid={tentou && form.nome_empresa.trim().length < 2}
              />
              {tentou && form.nome_empresa.trim().length < 2 && (
                <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Informe o nome da empresa.
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor={`${campoId}-contato`}>Nome do contato *</label>
              <input
                id={`${campoId}-contato`}
                className="input"
                value={form.contato_nome}
                onChange={event => patch('contato_nome', event.target.value)}
                maxLength={160}
                autoComplete="name"
                aria-invalid={tentou && form.contato_nome.trim().length < 3}
              />
              {tentou && form.contato_nome.trim().length < 3 && (
                <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Informe o nome do contato.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`${campoId}-email`}>E-mail</label>
                <input
                  id={`${campoId}-email`}
                  type="email"
                  className="input"
                  value={form.contato_email}
                  onChange={event => patch('contato_email', event.target.value)}
                  maxLength={160}
                  autoComplete="email"
                  aria-invalid={tentou && (!canalOk || !emailOk)}
                  aria-describedby={`${campoId}-canal`}
                />
              </div>
              <div>
                <label className="label" htmlFor={`${campoId}-telefone`}>Telefone</label>
                <input
                  id={`${campoId}-telefone`}
                  type="tel"
                  inputMode="tel"
                  className="input"
                  placeholder="(11) 99999-9999"
                  value={form.contato_telefone}
                  onChange={event => patch('contato_telefone', prospeccaoTelefoneDisplay(event.target.value))}
                  autoComplete="tel"
                  aria-invalid={tentou && !canalOk}
                  aria-describedby={`${campoId}-canal`}
                />
              </div>
            </div>
            <p
              id={`${campoId}-canal`}
              role={tentou && (!canalOk || !emailOk) ? 'alert' : undefined}
              className={tentou && (!canalOk || !emailOk) ? '-mt-2 flex items-center gap-1.5 text-xs text-danger' : '-mt-2 text-xs text-silver-500'}
            >
              {tentou && (!canalOk || !emailOk) && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {!canalOk || !tentou ? 'Informe ao menos um canal: e-mail ou telefone.' : 'Informe um e-mail válido.'}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`${campoId}-origem`}>Origem</label>
                <select
                  id={`${campoId}-origem`}
                  className="input h-10 py-0 text-sm"
                  value={form.origem}
                  onChange={event => patch('origem', event.target.value as ProspeccaoOrigem)}
                >
                  {PROSPECCAO_ORIGEM.map(origem => <option key={origem} value={origem}>{PROSPECCAO_ORIGEM_LABEL[origem]}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`${campoId}-proxima`}>Próxima ação em</label>
                <input
                  id={`${campoId}-proxima`}
                  type="date"
                  className="input"
                  value={form.proxima_acao_em}
                  onChange={event => patch('proxima_acao_em', event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor={`${campoId}-notas`}>Observações</label>
              <textarea
                id={`${campoId}-notas`}
                className="input min-h-20 resize-y py-3"
                value={form.notas}
                onChange={event => patch('notas', event.target.value)}
                maxLength={4000}
                placeholder="Anotações livres sobre a negociação — contexto para o próximo contato."
              />
              <p className="mt-1 text-right text-xs tabular-nums text-silver-400">{form.notas.length}/4000</p>
            </div>

            {erro && (
              <div className="flex gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {erro}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-silver-100 bg-silver-50 px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={pedirFechar} disabled={pendente}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={pendente}>
              {pendente && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {pendente ? 'Criando…' : 'Criar oportunidade'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

// Modal de detalhe da oportunidade do funil de prospecção (issue #34 — spec UX/UI).
// z-[60] (não <dialog>) para o ReasonDialog (z-[70]) e o diálogo de conversão abrirem
// por cima; bottom-sheet <sm; shell a11y do PropostaObservacoesModal (foco inicial no
// X, focus trap, ESC, retorno de foco, guarda de rascunho confirmarDescarte).
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle2, FileImage, Loader2, Paperclip, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReasonDialog } from '@/components/ui/reason-dialog'
import { useAuth } from '@/auth/AuthContext'
import { adminNivelOf } from '@/lib/adminScope'
import { supabase } from '@/lib/supabase'
import { isValidEmailFormat } from '@/lib/emailValidation'
import {
  PROSPECCAO_ORIGEM, PROSPECCAO_ORIGEM_LABEL, PROSPECCAO_STATUS_LABEL,
  prospeccaoTelefoneDigits, prospeccaoTelefoneDisplay,
  type ProspeccaoOrigem,
} from '@/lib/prospeccao'
import {
  createProspeccaoAnexoSignedUrl, openProspeccaoAnexo, uploadProspeccaoAnexo,
  validarArquivoProspeccao, PROSPECCAO_MAX_ANEXOS,
} from '@/lib/prospeccaoAnexo'
import {
  useProspeccaoArquivar, useProspeccaoHistorico, useProspeccaoUpdate, type ProspeccaoCard,
} from '@/hooks/useProspeccoes'
import { PROSPECCAO_ANEXOS_QUERY_PREFIX, useProspeccaoAnexos, type ProspeccaoAnexo } from '@/hooks/useProspeccaoAnexos'

type FormState = {
  nome_empresa: string
  contato_nome: string
  contato_email: string
  contato_telefone: string
  origem: ProspeccaoOrigem
  responsavel_id: string
  proxima_acao_em: string
  notas: string
}

type DirtyPayload = Partial<{
  nome_empresa: string
  contato_nome: string
  contato_email: string
  contato_telefone: string
  origem: ProspeccaoOrigem
  notas: string
  responsavel_id: string
  proxima_acao_em: string
}>

type AnexoDraft = {
  key: string
  file: File
  estado: 'enviando' | 'pronto' | 'erro'
  anexoId?: string
  erro?: string
  /** 'validacao' = determinístico (sem retry); 'upload' = transitório (com retry) */
  erroOrigem?: 'validacao' | 'upload'
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formFromCard(card: ProspeccaoCard): FormState {
  return {
    nome_empresa: card.nome_empresa,
    contato_nome: card.contato_nome,
    contato_email: card.contato_email ?? '',
    contato_telefone: prospeccaoTelefoneDisplay(card.contato_telefone ?? ''),
    origem: card.origem,
    responsavel_id: card.responsavel_id ?? '',
    proxima_acao_em: toDateInput(card.proxima_acao_em),
    notas: card.notas ?? '',
  }
}

function tempoAbsoluto(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function ProspeccaoDetalheModal({ card, onClose }: { card: ProspeccaoCard; onClose: () => void }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const nivel = adminNivelOf(session)
  const podeConverter = nivel === 'full' || nivel === 'comercial'

  const tituloId = useId()
  const subId = useId()
  const campoId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<Element | null>(null)
  const pendenteRef = useRef(false)

  // base = último estado persistido (snapshot do board; atualizado após salvar)
  const [base, setBase] = useState<ProspeccaoCard>(card)
  const [form, setForm] = useState<FormState>(() => formFromCard(card))
  const [tentou, setTentou] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [sucessoSalvar, setSucessoSalvar] = useState<string | null>(null)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  const [arquivarOpen, setArquivarOpen] = useState(false)
  const [arquivarErro, setArquivarErro] = useState<string | null>(null)
  const [converterOpen, setConverterOpen] = useState(false)
  const [drafts, setDrafts] = useState<AnexoDraft[]>([])

  const updateMut = useProspeccaoUpdate()
  const arquivarMut = useProspeccaoArquivar()
  const historicoQ = useProspeccaoHistorico(card.id)
  const anexosQ = useProspeccaoAnexos(card.id)

  const { data: responsaveis = [] } = useQuery({
    queryKey: ['admin-usuarios-role-admin'],
    queryFn: async (): Promise<{ id: string; nome_completo: string }[]> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_completo')
        .in('role', ['admin', 'team_member'])
        .order('nome_completo')
      if (error) throw error
      return data || []
    },
  })

  const email = form.contato_email.trim()
  const telDigits = prospeccaoTelefoneDigits(form.contato_telefone)
  const canalOk = email !== '' || telDigits.length > 0
  const emailOk = email === '' || isValidEmailFormat(email)
  const valido = form.nome_empresa.trim().length >= 2 && form.contato_nome.trim().length >= 3 && canalOk && emailOk

  // Diff persistível: o backend faz coalesce (null/'' mantêm o valor atual), então
  // campos "limpos" não são enviados — sujo = só o que de fato muda no servidor.
  function dirtyPayload(): DirtyPayload {
    const dirty: DirtyPayload = {}
    const nomeEmpresa = form.nome_empresa.trim()
    const contatoNome = form.contato_nome.trim()
    if (nomeEmpresa !== base.nome_empresa) dirty.nome_empresa = nomeEmpresa
    if (contatoNome !== base.contato_nome) dirty.contato_nome = contatoNome
    if (email && email.toLowerCase() !== (base.contato_email ?? '')) dirty.contato_email = email
    if (telDigits && telDigits !== (base.contato_telefone ?? '')) dirty.contato_telefone = telDigits
    if (form.origem !== base.origem) dirty.origem = form.origem
    if (form.notas !== (base.notas ?? '')) dirty.notas = form.notas
    if (form.responsavel_id && form.responsavel_id !== (base.responsavel_id ?? '')) dirty.responsavel_id = form.responsavel_id
    if (form.proxima_acao_em && form.proxima_acao_em !== toDateInput(base.proxima_acao_em)) {
      dirty.proxima_acao_em = new Date(`${form.proxima_acao_em}T12:00:00`).toISOString()
    }
    return dirty
  }

  const enviandoAnexo = drafts.some(d => d.estado === 'enviando')
  const sujo = Object.keys(dirtyPayload()).length > 0 || enviandoAnexo
  const pendente = updateMut.isPending || arquivarMut.isPending

  useEffect(() => {
    pendenteRef.current = pendente
  }, [pendente])

  // chips "pronto" somem quando a lista refletir o anexo (evita chip + thumb duplicados)
  useEffect(() => {
    if (!anexosQ.data) return
    const ids = new Set(anexosQ.data.map(a => a.id))
    setDrafts(prev => prev.some(d => d.estado === 'pronto' && d.anexoId && ids.has(d.anexoId))
      ? prev.filter(d => !(d.estado === 'pronto' && d.anexoId && ids.has(d.anexoId)))
      : prev)
  }, [anexosQ.data])

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
    if (arquivarOpen || converterOpen) return // diálogos por cima tratam o próprio ESC/backdrop
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
      if (arquivarOpen || converterOpen) return // diálogos por cima têm o próprio trap
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
    setErroSalvar(null)
    setSucessoSalvar(null)
  }

  function salvar() {
    setTentou(true)
    const dirty = dirtyPayload()
    if (!valido || Object.keys(dirty).length === 0 || pendente) return
    setErroSalvar(null)
    setSucessoSalvar(null)
    updateMut.mutate(
      { id: card.id, ...dirty },
      {
        onSuccess: () => {
          const aplicado: ProspeccaoCard = {
            ...base,
            nome_empresa: dirty.nome_empresa ?? base.nome_empresa,
            contato_nome: dirty.contato_nome ?? base.contato_nome,
            contato_email: dirty.contato_email ? dirty.contato_email.toLowerCase() : base.contato_email,
            contato_telefone: dirty.contato_telefone ? dirty.contato_telefone : base.contato_telefone,
            origem: dirty.origem ?? base.origem,
            notas: dirty.notas !== undefined ? (dirty.notas || null) : base.notas,
            responsavel_id: dirty.responsavel_id ?? base.responsavel_id,
            responsavel_nome: dirty.responsavel_id
              ? (responsaveis.find(r => r.id === dirty.responsavel_id)?.nome_completo ?? base.responsavel_nome)
              : base.responsavel_nome,
            proxima_acao_em: dirty.proxima_acao_em ?? base.proxima_acao_em,
            updated_at: new Date().toISOString(),
          }
          setBase(aplicado)
          setForm(formFromCard(aplicado))
          setTentou(false)
          setConfirmarDescarte(false)
          setSucessoSalvar('Alterações salvas.')
        },
        onError: (err) => setErroSalvar(err.message),
      },
    )
  }

  function iniciarUpload(key: string, file: File) {
    setDrafts((prev) => {
      const existe = prev.some(a => a.key === key)
      const atualizado = { key, file, estado: 'enviando' as const }
      return existe
        ? prev.map(a => (a.key === key ? { ...atualizado, erro: undefined, anexoId: undefined } : a))
        : [...prev, atualizado]
    })
    uploadProspeccaoAnexo(card.id, file)
      .then((anexoId) => {
        setDrafts(prev => prev.map(a => (a.key === key ? { ...a, estado: 'pronto', anexoId } : a)))
        void qc.invalidateQueries({ queryKey: PROSPECCAO_ANEXOS_QUERY_PREFIX })
      })
      .catch((err: unknown) => setDrafts(prev => prev.map(a => (a.key === key
        ? { ...a, estado: 'erro', erro: err instanceof Error ? err.message : 'Falha ao enviar o print.', erroOrigem: 'upload' as const }
        : a))))
  }

  function handleSelecionarArquivos(files: FileList | null) {
    if (!files) return
    const persistidos = anexosQ.data?.length ?? 0
    const livres = PROSPECCAO_MAX_ANEXOS - persistidos - drafts.length
    const selecionados = Array.from(files).slice(0, Math.max(0, livres))
    for (const file of selecionados) {
      const invalido = validarArquivoProspeccao(file)
      const key = `${file.name}-${file.size}-${file.lastModified}`
      if (invalido) {
        setDrafts(prev => (prev.some(a => a.key === key)
          ? prev
          : [...prev, { key, file, estado: 'erro', erro: invalido, erroOrigem: 'validacao' }]))
        continue
      }
      iniciarUpload(key, file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const anexos = anexosQ.data ?? []
  const limiteAnexosAtingido = anexos.length + drafts.length >= PROSPECCAO_MAX_ANEXOS
  const responsavelAtualNaLista = !form.responsavel_id || responsaveis.some(r => r.id === form.responsavel_id)

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
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-silver-200 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-silver-100 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {PROSPECCAO_STATUS_LABEL[base.status]}
            </span>
            <h2 id={tituloId} className="mt-1 truncate text-lg font-bold text-slate-950">{base.nome_empresa}</h2>
            <p id={subId} className="mt-0.5 text-xs text-silver-500">
              Criado em {new Date(base.created_at).toLocaleDateString('pt-BR')} · Responsável: {base.responsavel_nome ?? 'Sem responsável'}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={pedirFechar}
            aria-label="Fechar detalhes"
            className="btn-no-liquid -mr-2 shrink-0 rounded-md p-2 text-silver-500 hover:bg-silver-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {confirmarDescarte && (
          <div className="shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2 sm:px-6" role="alert">
            <div className="flex flex-col gap-2 text-xs text-silver-800 sm:flex-row sm:items-center sm:justify-between">
              <span>Descartar o rascunho? Você tem alterações não salvas.</span>
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-silver-50 px-4 py-4 sm:px-6">
          <section aria-label="Dados do contato" className="card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-silver-500">Dados do contato</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`${campoId}-empresa`}>Empresa *</label>
                <input
                  id={`${campoId}-empresa`}
                  className="input"
                  value={form.nome_empresa}
                  onChange={event => patch('nome_empresa', event.target.value)}
                  maxLength={160}
                  aria-invalid={tentou && form.nome_empresa.trim().length < 2}
                />
              </div>
              <div>
                <label className="label" htmlFor={`${campoId}-contato`}>Nome do contato *</label>
                <input
                  id={`${campoId}-contato`}
                  className="input"
                  value={form.contato_nome}
                  onChange={event => patch('contato_nome', event.target.value)}
                  maxLength={160}
                  aria-invalid={tentou && form.contato_nome.trim().length < 3}
                />
              </div>
              <div>
                <label className="label" htmlFor={`${campoId}-email`}>E-mail</label>
                <input
                  id={`${campoId}-email`}
                  type="email"
                  className="input"
                  value={form.contato_email}
                  onChange={event => patch('contato_email', event.target.value)}
                  maxLength={160}
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
                  aria-invalid={tentou && !canalOk}
                  aria-describedby={`${campoId}-canal`}
                />
              </div>
              <div className="sm:col-span-2">
                <p
                  id={`${campoId}-canal`}
                  role={tentou && (!canalOk || !emailOk) ? 'alert' : undefined}
                  className={tentou && (!canalOk || !emailOk) ? 'flex items-center gap-1.5 text-xs text-danger' : 'text-xs text-silver-500'}
                >
                  {tentou && (!canalOk || !emailOk) && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  {!canalOk || !tentou ? 'Informe ao menos um canal: e-mail ou telefone.' : 'Informe um e-mail válido.'}
                </p>
              </div>
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
                <label className="label" htmlFor={`${campoId}-responsavel`}>Responsável</label>
                <select
                  id={`${campoId}-responsavel`}
                  className="input h-10 py-0 text-sm"
                  value={form.responsavel_id}
                  onChange={event => patch('responsavel_id', event.target.value)}
                >
                  {form.responsavel_id === '' && <option value="" disabled>Selecionar responsável</option>}
                  {!responsavelAtualNaLista && base.responsavel_nome && (
                    <option value={form.responsavel_id}>{base.responsavel_nome}</option>
                  )}
                  {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome_completo}</option>)}
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
          </section>

          <section aria-label="Observações" className="card mt-4 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-silver-500">Observações</h3>
            <label className="sr-only" htmlFor={`${campoId}-notas`}>Observações</label>
            <textarea
              id={`${campoId}-notas`}
              className="input mt-3 min-h-24 resize-y py-3"
              value={form.notas}
              onChange={event => patch('notas', event.target.value)}
              maxLength={4000}
              placeholder="Anotações livres sobre a negociação — contexto para o próximo contato."
            />
            <p className="mt-1 text-right text-xs tabular-nums text-silver-400">{form.notas.length}/4000</p>
          </section>

          <section aria-label="Prints e anexos" className="card mt-4 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-silver-500">Prints e anexos</h3>
            <p className="mt-1 text-xs text-silver-500">
              Anexe até {PROSPECCAO_MAX_ANEXOS} prints (JPG, PNG, WEBP ou HEIC, 2 MB cada) que ajudem a justificar a mudança de status.
            </p>

            {drafts.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {drafts.map((a) => (
                  <li
                    key={a.key}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                      a.estado === 'erro' ? 'border-danger/40 bg-danger/5 text-danger' : 'border-silver-200 bg-white text-silver-700'
                    }`}
                  >
                    {a.estado === 'enviando' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {a.estado === 'pronto' && <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />}
                    {a.estado === 'erro' && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span className="max-w-40 truncate" title={a.file.name}>{a.file.name}</span>
                    {a.estado === 'enviando' && <span>Enviando…</span>}
                    {a.estado === 'pronto' && <span className="text-success">Anexado</span>}
                    {a.estado === 'erro' && (
                      <>
                        {a.erroOrigem !== 'validacao' && (
                          <button type="button" className="font-semibold underline" title={a.erro} onClick={() => iniciarUpload(a.key, a.file)}>
                            Tentar de novo
                          </button>
                        )}
                        <button type="button" className="font-semibold underline" onClick={() => setDrafts(prev => prev.filter(x => x.key !== a.key))}>
                          Remover
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {anexosQ.isLoading && (
              <p className="mt-3 flex items-center gap-2 text-xs text-silver-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Carregando anexos…
              </p>
            )}
            {anexosQ.isError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-danger" role="alert">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Não foi possível carregar os anexos.
              </p>
            )}
            {anexos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {anexos.map(anexo => (
                  <li key={anexo.id}>
                    <AnexoThumb anexo={anexo} />
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
                onChange={(event) => handleSelecionarArquivos(event.target.files)}
              />
              <button
                type="button"
                className="btn-no-liquid btn-outline h-9 px-3 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={pendente || enviandoAnexo || limiteAnexosAtingido}
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" /> Anexar print
              </button>
            </div>
          </section>

          <section aria-label="Histórico" className="card mt-4 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-silver-500">Histórico</h3>
            {historicoQ.isLoading && (
              <p className="mt-3 flex items-center gap-2 text-xs text-silver-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Carregando histórico…
              </p>
            )}
            {historicoQ.isError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-danger" role="alert">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Não foi possível carregar o histórico.
              </p>
            )}
            {historicoQ.data && (
              <ol className="mt-3 space-y-3">
                {historicoQ.data.map(item => {
                  const autor = item.autor_nome ?? 'Equipe'
                  return (
                    <li key={item.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-silver-300" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-silver-800">
                          {item.status_anterior === null ? (
                            <>{autor} criou o card em <span className="font-semibold">{PROSPECCAO_STATUS_LABEL[item.status_novo]}</span></>
                          ) : (
                            <>{autor} moveu de <span className="font-semibold">{PROSPECCAO_STATUS_LABEL[item.status_anterior]}</span> → <span className="font-semibold">{PROSPECCAO_STATUS_LABEL[item.status_novo]}</span></>
                          )}
                        </p>
                        <time className="text-xs text-silver-500" dateTime={item.alterado_em}>{tempoAbsoluto(item.alterado_em)}</time>
                      </div>
                    </li>
                  )
                })}
                {base.arquivado_em && (
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm text-silver-800">
                        Arquivado{base.motivo_arquivamento ? <> — <span className="font-semibold">{base.motivo_arquivamento}</span></> : null}
                      </p>
                      <time className="text-xs text-silver-500" dateTime={base.arquivado_em}>{tempoAbsoluto(base.arquivado_em)}</time>
                    </div>
                  </li>
                )}
              </ol>
            )}
          </section>

          {erroSalvar && (
            <div className="mt-4 flex gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {erroSalvar}
            </div>
          )}
          {sucessoSalvar && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success" aria-live="polite">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {sucessoSalvar}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-silver-100 bg-silver-50 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="btn-no-liquid btn-outline text-danger"
            onClick={() => { setArquivarErro(null); setArquivarOpen(true) }}
            disabled={pendente}
          >
            Arquivar
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {base.proposta_id && (
              <Link to={`/admin/propostas/${base.proposta_id}`} className="btn-no-liquid btn-outline text-xs">
                Ver proposta vinculada
              </Link>
            )}
            {base.status === 'converter_proposta' && !base.proposta_id && (
              <span title={podeConverter ? undefined : 'A conversão é executada por um admin full ou comercial.'} className="inline-flex">
                <button
                  type="button"
                  className="btn-gold"
                  disabled={!podeConverter || pendente}
                  onClick={() => setConverterOpen(true)}
                >
                  Converter em proposta
                </button>
              </span>
            )}
            <Button variant="primary" onClick={salvar} disabled={!sujo || !valido || pendente || enviandoAnexo}>
              {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {updateMut.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </section>

      <ReasonDialog
        open={arquivarOpen}
        title="Arquivar oportunidade"
        description="Arquivar remove a oportunidade do funil. O motivo fica registrado na auditoria."
        context={base.nome_empresa}
        reasonLabel="Motivo do arquivamento"
        reasonPlaceholder="Descreva o motivo (perda, desistência, duplicidade…)"
        confirmLabel="Arquivar"
        pendingLabel="Arquivando..."
        minLength={3}
        pending={arquivarMut.isPending}
        serverError={arquivarErro}
        onClose={() => setArquivarOpen(false)}
        onConfirm={(motivo) => {
          setArquivarErro(null)
          arquivarMut.mutate(
            { id: card.id, motivo },
            {
              onSuccess: () => { setArquivarOpen(false); onClose() },
              onError: (err) => setArquivarErro(err.message),
            },
          )
        }}
      />

      {converterOpen && (
        <ConverterConfirmDialog
          onCancel={() => setConverterOpen(false)}
          onConfirm={() => {
            setConverterOpen(false)
            onClose()
            navigate(`/admin/propostas/nova?prospeccao=${card.id}`)
          }}
        />
      )}
    </div>
  )
}

// Diálogo de confirmação da conversão (S1): o payload completo da proposta é
// coletado pelo assistente /admin/propostas/nova, que submete via
// useProspeccaoConverter (admin_prospeccao_converter) — o vínculo e a auditoria
// ficam na RPC dedicada.
function ConverterConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const tituloId = useId()
  const descId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const openerRef = useRef<Element | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0)
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focaveis = panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
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
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKeyDown)
      const abridor = openerRef.current
      if (abridor instanceof HTMLElement && document.contains(abridor)) abridor.focus()
    }
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-silver-950/55 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-xl border border-silver-200 bg-white p-6 shadow-2xl"
      >
        <h2 id={tituloId} className="text-lg font-bold text-silver-900">Converter em proposta?</h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-silver-600">
          O assistente de nova proposta será aberto. Ao concluir, a proposta criada ficará vinculada a esta oportunidade e a conversão será registrada na auditoria.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <button ref={confirmRef} type="button" className="btn-gold" onClick={onConfirm}>
            Continuar para a proposta
          </button>
        </div>
      </section>
    </div>
  )
}

// Thumbnail de anexo com signed URL (TTL 300s); HEIC não renderiza no navegador →
// fallback "Abrir em nova aba" (mesmo padrão do PropostaObservacoesModal).
function AnexoThumb({ anexo }: { anexo: ProspeccaoAnexo }) {
  const isHeic = anexo.mime_type === 'image/heic'
  const urlQ = useQuery({
    queryKey: [...PROSPECCAO_ANEXOS_QUERY_PREFIX, 'url', anexo.id],
    enabled: !isHeic,
    staleTime: 240_000, // < TTL de 300s da signed URL
    queryFn: () => createProspeccaoAnexoSignedUrl(anexo.storage_path),
    retry: 1,
  })

  const [erroAbrir, setErroAbrir] = useState(false)

  async function abrir() {
    setErroAbrir(false)
    try {
      const url = await createProspeccaoAnexoSignedUrl(anexo.storage_path) // URL nova a cada clique
      openProspeccaoAnexo(url)
    } catch {
      setErroAbrir(true)
    }
  }

  if (isHeic) {
    return (
      <button
        type="button"
        onClick={abrir}
        aria-label={`Abrir print ${anexo.nome} em nova aba`}
        className="btn-no-liquid flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-silver-200 bg-silver-100 text-silver-500 hover:bg-silver-200"
      >
        <FileImage className="h-5 w-5" aria-hidden="true" />
        <span className="text-[9px] font-semibold">HEIC · abrir</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={abrir}
      aria-label={`Abrir print ${anexo.nome} em nova aba`}
      className="btn-no-liquid h-16 w-16 overflow-hidden rounded-md border border-silver-200 bg-silver-100"
    >
      {urlQ.isLoading && <span className="block h-full w-full animate-pulse bg-silver-100" aria-hidden="true" />}
      {(urlQ.isError || erroAbrir) && (
        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-silver-500" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span className="text-[9px] font-semibold">Recarregar</span>
        </span>
      )}
      {urlQ.data && !erroAbrir && (
        <img src={urlQ.data} alt={`Print anexado: ${anexo.nome}`} className="h-full w-full object-cover" />
      )}
    </button>
  )
}

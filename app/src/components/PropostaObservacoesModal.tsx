// Modal de observações internas da proposta (issue #22, spec UX/UI aprovada).
// Timeline carimbada por etapa + composer com até 3 prints (2 fases) + janela de
// edição de 15 min + remoção admin via ReasonDialog. div z-[60] (não <dialog>)
// para o ReasonDialog (z-[70]) abrir por cima.
import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle2, FileImage, Loader2, Paperclip, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReasonDialog } from '@/components/ui/reason-dialog'
import { useAuth } from '@/auth/AuthContext'
import { PROPOSTA_STATUS_LABEL } from '@/lib/propostaStatus'
import {
  createObservacaoAnexoSignedUrl,
  openObservacaoAnexo,
  uploadObservacaoAnexo,
  validarArquivoObservacao,
  PROPOSTA_OBS_MAX_ANEXOS,
} from '@/lib/propostaObservacaoAnexo'
import {
  useObservacaoCriar,
  useObservacaoEditar,
  useObservacaoRemover,
  usePropostaObservacoes,
  type PropostaObservacao,
  type ObservacaoAnexo,
} from '@/hooks/usePropostaObservacoes'

const JANELA_EDICAO_MS = 15 * 60 * 1000

const PAPEL_LABEL: Record<string, string> = {
  admin: 'Admin',
  partner: 'Parceiro',
  team_member: 'Assistente',
}

function tempoRelativo(iso: string, agora = Date.now()): string {
  const diff = agora - Date.parse(iso)
  if (diff < 60_000) return 'agora mesmo'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `há ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function tempoAbsoluto(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?'
}

export interface PropostaObservacoesModalProposta {
  id: string
  protocolo?: string | null
  cliente_nome?: string | null
}

type AnexoDraft = {
  key: string
  file: File
  estado: 'enviando' | 'pronto' | 'erro'
  anexoId?: string
  erro?: string
}

export function PropostaObservacoesModal({
  proposta,
  onClose,
}: {
  proposta: PropostaObservacoesModalProposta
  onClose: () => void
}) {
  const { session } = useAuth()
  const tituloId = useId()
  const subId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<Element | null>(null)

  const listaQ = usePropostaObservacoes(proposta.id)
  const criarMut = useObservacaoCriar(proposta.id)
  const editarMut = useObservacaoEditar(proposta.id)
  const removerMut = useObservacaoRemover(proposta.id)

  const [corpo, setCorpo] = useState('')
  const [anexos, setAnexos] = useState<AnexoDraft[]>([])
  const [erroComposer, setErroComposer] = useState<string | null>(null)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  const [removerAlvo, setRemoverAlvo] = useState<PropostaObservacao | null>(null)
  const [confirmarAutorId, setConfirmarAutorId] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  const sujo = corpo.trim().length > 0 || anexos.length > 0
  const enviandoAnexo = anexos.some((a) => a.estado === 'enviando')
  const pendente = criarMut.isPending || editarMut.isPending || removerMut.isPending

  // countdown da janela (30s) — relógio do cliente é só UX; servidor é autoridade
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // foco inicial no X + captura do elemento que abriu (para devolver o foco)
  useEffect(() => {
    openerRef.current = document.activeElement
    const t = window.setTimeout(() => closeRef.current?.focus(), 0)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      const alvo = openerRef.current instanceof HTMLElement
        ? openerRef.current
        : document.querySelector(`[data-obs-trigger="${proposta.id}"]`)
      if (alvo instanceof HTMLElement) alvo.focus()
    }
  }, [proposta.id])

  function pedirFechar() {
    if (pendente) return
    if (removerAlvo) return // ReasonDialog aberto trata o próprio ESC/backdrop
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
      if (removerAlvo) return // ReasonDialog (por cima) tem o próprio trap
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
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  function handleSelecionarArquivos(files: FileList | null) {
    if (!files) return
    setErroComposer(null)
    const livres = PROPOSTA_OBS_MAX_ANEXOS - anexos.length
    const selecionados = Array.from(files).slice(0, Math.max(0, livres))
    if (files.length > livres) setErroComposer(`Máximo de ${PROPOSTA_OBS_MAX_ANEXOS} prints por observação.`)
    for (const file of selecionados) {
      const invalido = validarArquivoObservacao(file)
      const key = `${file.name}-${file.size}-${file.lastModified}`
      if (invalido) {
        setAnexos((prev) => [...prev, { key, file, estado: 'erro', erro: invalido }])
        continue
      }
      setAnexos((prev) => [...prev, { key, file, estado: 'enviando' }])
      uploadObservacaoAnexo(proposta.id, file)
        .then((anexoId) => setAnexos((prev) => prev.map((a) => (a.key === key ? { ...a, estado: 'pronto', anexoId } : a))))
        .catch((err: unknown) => setAnexos((prev) => prev.map((a) => (a.key === key
          ? { ...a, estado: 'erro', erro: err instanceof Error ? err.message : 'Falha ao enviar o print.' }
          : a))))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handlePublicar(event: React.FormEvent) {
    event.preventDefault()
    const texto = corpo.trim()
    if (!texto || enviandoAnexo || pendente) return
    setErroComposer(null)
    criarMut.mutate(
      { corpo: texto, anexoIds: anexos.filter((a) => a.estado === 'pronto' && a.anexoId).map((a) => a.anexoId!) },
      {
        onSuccess: () => {
          setCorpo('')
          setAnexos([])
          setConfirmarDescarte(false)
        },
        onError: (err) => setErroComposer(err.message),
      },
    )
  }

  const observacoes = listaQ.data ?? []

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
            <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Observações internas</p>
            <h2 id={tituloId} className="mt-0.5 truncate text-lg font-bold text-slate-950">
              {proposta.cliente_nome || 'Cliente não informado'}
            </h2>
            <p id={subId} className="mt-0.5 text-xs text-silver-500">
              <span className="font-mono">{proposta.protocolo || proposta.id.slice(0, 8)}</span>
              {' · Visível apenas para a equipe e a operação.'}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={pedirFechar}
            aria-label="Fechar observações"
            className="btn-no-liquid -mr-2 shrink-0 rounded-md p-2 text-silver-500 hover:bg-silver-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {listaQ.isLoading && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-silver-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando observações…
            </p>
          )}
          {listaQ.isError && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger" role="alert">
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Não foi possível carregar as observações.
              </p>
              <button
                type="button"
                className="btn-no-liquid btn-outline mt-3"
                onClick={() => listaQ.refetch()}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {listaQ.isSuccess && observacoes.length === 0 && (
            <div className="py-10 text-center">
              <p className="font-semibold text-navy">Nenhuma observação ainda.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-silver-600">
                Registre a primeira: texto, print de erro ou comprovação. Cada entrada fica marcada com a etapa atual da proposta.
              </p>
            </div>
          )}
          {observacoes.length > 0 && (
            <ol className="divide-y divide-transparent">
              {observacoes.map((obs) => (
                <ObservacaoItem
                  key={obs.id}
                  obs={obs}
                  agora={agora}
                  sessionUserId={session?.userId}
                  isAdmin={session?.role === 'admin'}
                  onEditar={(id, texto, callbacks) =>
                    editarMut.mutate({ id, corpo: texto }, callbacks)}
                  editandoPendente={editarMut.isPending}
                  onApagarAutor={(id) => setConfirmarAutorId(id)}
                  confirmandoAutor={confirmarAutorId === obs.id}
                  onConfirmarApagarAutor={(id) =>
                    removerMut.mutate({ id }, {
                      onSuccess: () => setConfirmarAutorId(null),
                      onError: (err) => { setConfirmarAutorId(null); setErroComposer(err.message) },
                    })}
                  onCancelarApagarAutor={() => setConfirmarAutorId(null)}
                  onApagarAdmin={(o) => setRemoverAlvo(o)}
                />
              ))}
            </ol>
          )}
        </div>

        {confirmarDescarte && (
          <div className="shrink-0 border-t border-warning/40 bg-warning/10 px-4 py-2 sm:px-6" role="alert">
            <div className="flex flex-col gap-2 text-xs text-silver-800 sm:flex-row sm:items-center sm:justify-between">
              <span>Descartar o rascunho? Você tem texto ou anexos não publicados.</span>
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

        <form onSubmit={handlePublicar} className="shrink-0 border-t border-silver-100 bg-silver-50 px-4 py-3 sm:px-6">
          <label className="sr-only" htmlFor={`${tituloId}-composer`}>Nova observação</label>
          <textarea
            id={`${tituloId}-composer`}
            className="input min-h-20 resize-y bg-white"
            maxLength={4000}
            value={corpo}
            onChange={(event) => setCorpo(event.target.value)}
            placeholder="Escreva uma observação interna… (ex.: descreva o erro e anexe o print)"
            disabled={pendente}
          />
          <div className="mt-1 flex items-start justify-between gap-3 text-xs">
            <p className={erroComposer ? 'flex items-center gap-1.5 text-danger' : 'text-silver-500'} role={erroComposer ? 'alert' : undefined}>
              {erroComposer && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {erroComposer ?? `Anexe até ${PROPOSTA_OBS_MAX_ANEXOS} prints (JPG, PNG, WEBP ou HEIC, 2 MB cada).`}
            </p>
            <span className={`shrink-0 tabular-nums ${corpo.length >= 4000 ? 'text-danger' : 'text-silver-400'}`}>
              {corpo.length}/4000
            </span>
          </div>

          {anexos.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {anexos.map((a) => (
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
                  <span className="text-silver-400">{Math.max(1, Math.round(a.file.size / 1024))} KB</span>
                  {a.estado === 'enviando' && <span>Enviando…</span>}
                  {a.estado === 'pronto' && <span className="text-success">Anexado</span>}
                  {a.estado === 'erro' && (
                    <button
                      type="button"
                      className="font-semibold underline"
                      title={a.erro}
                      onClick={() => setAnexos((prev) => prev.filter((x) => x.key !== a.key))}
                    >
                      Remover
                    </button>
                  )}
                  {a.estado === 'pronto' && (
                    <button
                      type="button"
                      className="font-semibold text-silver-500 hover:text-danger"
                      aria-label={`Remover anexo ${a.file.name}`}
                      onClick={() => setAnexos((prev) => prev.filter((x) => x.key !== a.key))}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
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
                disabled={pendente || anexos.length >= PROPOSTA_OBS_MAX_ANEXOS}
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" /> Anexar print
              </button>
            </div>
            <Button type="submit" variant="primary" disabled={!corpo.trim() || enviandoAnexo || pendente}>
              {criarMut.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {criarMut.isPending ? 'Publicando…' : 'Publicar'}
            </Button>
          </div>
        </form>
      </section>

      {/* sucesso anunciado para leitores de tela */}
      <span aria-live="polite" className="sr-only">
        {criarMut.isSuccess ? 'Observação publicada.' : ''}
      </span>

      <ReasonDialog
        open={removerAlvo !== null}
        title="Remover observação"
        description="Ela sai da timeline e do contador, mas permanece na trilha de auditoria visível a administradores."
        context={removerAlvo ? `"${removerAlvo.corpo.slice(0, 140)}${removerAlvo.corpo.length > 140 ? '…' : ''}"` : undefined}
        confirmLabel="Remover"
        pendingLabel="Removendo…"
        reasonLabel="Motivo da remoção"
        reasonPlaceholder="Descreva por que esta observação precisa ser removida."
        pending={removerMut.isPending}
        serverError={removerMut.isError ? removerMut.error.message : null}
        onClose={() => { if (!removerMut.isPending) { removerMut.reset(); setRemoverAlvo(null) } }}
        onConfirm={(motivo) => {
          if (!removerAlvo) return
          removerMut.mutate({ id: removerAlvo.id, motivo }, {
            onSuccess: () => { removerMut.reset(); setRemoverAlvo(null) },
          })
        }}
      />
    </div>
  )
}

// ---------------- item da timeline ----------------

function ObservacaoItem({
  obs,
  agora,
  sessionUserId,
  isAdmin,
  onEditar,
  editandoPendente,
  onApagarAutor,
  confirmandoAutor,
  onConfirmarApagarAutor,
  onCancelarApagarAutor,
  onApagarAdmin,
}: {
  obs: PropostaObservacao
  agora: number
  sessionUserId: string | undefined
  isAdmin: boolean
  onEditar: (id: string, corpo: string, callbacks: { onSuccess: () => void; onError: (err: Error) => void }) => void
  editandoPendente: boolean
  onApagarAutor: (id: string) => void
  confirmandoAutor: boolean
  onConfirmarApagarAutor: (id: string) => void
  onCancelarApagarAutor: () => void
  onApagarAdmin: (obs: PropostaObservacao) => void
}) {
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState(obs.corpo)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)

  const criadoEm = Date.parse(obs.created_at)
  const restanteMs = criadoEm + JANELA_EDICAO_MS - agora
  const naJanela = restanteMs > 0
  const isAutor = obs.autor_id === sessionUserId
  const minutosRestantes = Math.max(0, Math.ceil(restanteMs / 60_000))

  return (
    <li className="flex gap-3">
      <div className="flex w-8 shrink-0 flex-col items-center">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-silver-100 text-xs font-bold text-silver-600" aria-hidden="true">
          {iniciais(obs.autor_nome)}
        </span>
        <span className="mt-1 w-px flex-1 bg-silver-100" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-silver-900">{obs.autor_nome}</span>
          <span className="rounded-md bg-silver-100 px-1.5 py-0.5 text-[10px] font-semibold text-silver-600">
            {PAPEL_LABEL[obs.autor_papel] ?? obs.autor_papel}
          </span>
          <span className="rounded-full border border-silver-200 bg-white px-2 py-0.5 text-[10px] font-medium text-silver-700">
            {PROPOSTA_STATUS_LABEL[obs.etapa_snapshot] ?? obs.etapa_snapshot}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-silver-400">
          <time dateTime={obs.created_at} title={tempoAbsoluto(obs.created_at)}>{tempoRelativo(obs.created_at, agora)}</time>
          {obs.editado_em && <span title={`Editado em ${tempoAbsoluto(obs.editado_em)}`}> · (editado)</span>}
        </p>

        {editando ? (
          <div className="mt-1.5">
            <textarea
              className="input min-h-20 resize-y"
              maxLength={4000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={editandoPendente}
              aria-label={`Editar observação de ${obs.autor_nome}`}
            />
            {erroEdicao && (
              <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-danger">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {erroEdicao}
              </p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs">
              <button
                type="button"
                className="btn-no-liquid font-semibold text-navy"
                disabled={!draft.trim() || editandoPendente}
                onClick={() => {
                  setErroEdicao(null)
                  // a caixa de edição só fecha com sucesso confirmado; erro fica no item
                  onEditar(obs.id, draft.trim(), {
                    onSuccess: () => setEditando(false),
                    onError: (err) => setErroEdicao(err.message),
                  })
                }}
              >
                {editandoPendente ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                type="button"
                className="btn-no-liquid text-silver-500"
                disabled={editandoPendente}
                onClick={() => { setEditando(false); setDraft(obs.corpo) }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-silver-800">{obs.corpo}</p>
        )}

        {obs.anexos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {obs.anexos.map((anexo) => (
              <AnexoThumb key={anexo.id} anexo={anexo} />
            ))}
          </div>
        )}

        {!editando && (isAutor && naJanela) && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="btn-no-liquid font-semibold text-silver-600 hover:text-navy" onClick={() => setEditando(true)}>
              Editar
            </button>
            {confirmandoAutor ? (
              <>
                <span className="text-silver-600">Apagar esta observação?</span>
                <button type="button" className="btn-no-liquid font-semibold text-silver-600" onClick={onCancelarApagarAutor}>
                  Manter
                </button>
                <button type="button" className="btn-no-liquid font-semibold text-danger" onClick={() => onConfirmarApagarAutor(obs.id)}>
                  Apagar
                </button>
              </>
            ) : (
              <button type="button" className="btn-no-liquid font-semibold text-danger" onClick={() => onApagarAutor(obs.id)}>
                Apagar
              </button>
            )}
            <span className="text-silver-400">Editável por mais {minutosRestantes} min</span>
          </div>
        )}
        {!editando && isAdmin && !(isAutor && naJanela) && (
          <div className="mt-2 text-xs">
            <button type="button" className="btn-no-liquid font-semibold text-danger" onClick={() => onApagarAdmin(obs)}>
              Remover (admin)
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

// ---------------- thumbnail de anexo ----------------

function AnexoThumb({ anexo }: { anexo: ObservacaoAnexo }) {
  const isHeic = anexo.mime_type === 'image/heic'
  const urlQ = useQuery({
    queryKey: ['proposta-obs-anexo-url', anexo.id],
    enabled: !isHeic,
    staleTime: 240_000, // < TTL de 300s da signed URL
    queryFn: () => createObservacaoAnexoSignedUrl(anexo.storage_path),
    retry: 1,
  })

  const [erroAbrir, setErroAbrir] = useState(false)

  async function abrir() {
    setErroAbrir(false)
    try {
      const url = await createObservacaoAnexoSignedUrl(anexo.storage_path) // URL nova a cada clique
      openObservacaoAnexo(url)
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

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Loader2, Paperclip, Upload } from 'lucide-react'
import { useProspeccaoClienteAnexos, B2C_ANEXOS_QUERY_KEY, type AnexoCliente } from '@/hooks/useProspeccaoClienteAnexos'
import { B2C_ANEXO_MAX, cancelarAnexoCliente, enviarAnexoCliente, prepararAnexoCliente, urlAnexoCliente, validarArquivoProspeccaoCliente, type ReservaAnexoCliente } from '@/lib/prospeccaoClienteAnexo'

type Draft = { key: string; file: File; estado: 'enviando' | 'erro' | 'pronto'; erro?: string; reserva?: ReservaAnexoCliente }
export function ProspeccaoClienteAnexos({ id, readOnly, onBusy, onDraft, discardRef }: {
  id: string; readOnly: boolean; onBusy: (value: boolean) => void; onDraft: (value: boolean) => void
  discardRef: RefObject<(() => Promise<void>) | null>
}) {
  const qc = useQueryClient()
  const query = useProspeccaoClienteAnexos([id])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const draftRef = useRef<Draft[]>([])
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const active = useRef(true)
  const busy = drafts.some(draft => draft.estado === 'enviando')
  function update(next: Draft[]) { draftRef.current = next; if (active.current) setDrafts(next) }
  useEffect(() => { onBusy(busy); onDraft(drafts.some(draft => draft.estado === 'erro')) }, [busy, drafts, onBusy, onDraft])
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    // Sincroniza chips concluídos apenas quando o refetch já contém seus IDs.
    const received = new Set((query.data ?? []).map(anexo => anexo.id))
    const next = draftRef.current.filter(draft => !(draft.estado === 'pronto' && draft.reserva && received.has(draft.reserva.anexo_id)))
    if (next.length !== draftRef.current.length) { draftRef.current = next; setDrafts(next) }
  }, [query.data])
  useEffect(() => {
    const cleanup = async () => {
      for (const draft of draftRef.current) {
        if (draft.estado === 'erro' && draft.reserva) await cancelarAnexoCliente(draft.reserva)
      }
      update([])
    }
    if (discardRef) (discardRef as { current: (() => Promise<void>) | null }).current = cleanup
    return () => { if (discardRef) (discardRef as { current: (() => Promise<void>) | null }).current = null }
  }, [discardRef])

  async function send(draft: Draft) {
    update(draftRef.current.map(item => item.key === draft.key ? { ...item, estado: 'enviando', erro: undefined } : item))
    try {
      const reserva = draft.reserva ?? await prepararAnexoCliente(id, draft.file)
      update(draftRef.current.map(item => item.key === draft.key ? { ...item, reserva } : item))
      await enviarAnexoCliente(reserva, draft.file)
      update(draftRef.current.map(item => item.key === draft.key ? { ...item, estado: 'pronto' } : item))
      await qc.invalidateQueries({ queryKey: B2C_ANEXOS_QUERY_KEY })
    } catch (failure) {
      update(draftRef.current.map(item => item.key === draft.key ? { ...item, estado: 'erro', erro: failure instanceof Error ? failure.message : 'Falha ao enviar.' } : item))
    }
  }

  function select(files: File[]) {
    if (readOnly || query.isPending || query.isError || busy) return
    setError(null)
    let remaining = B2C_ANEXO_MAX - (query.data?.length ?? 0) - draftRef.current.length
    for (const file of files) {
      if (remaining <= 0) { setError('Cada prospect permite até 3 prints. Remova rascunhos inválidos para tentar novamente.'); break }
      const key = file.name + ':' + file.size + ':' + file.lastModified
      if (draftRef.current.some(draft => draft.key === key)) continue
      const invalid = validarArquivoProspeccaoCliente(file)
      const draft: Draft = { key, file, estado: invalid ? 'erro' : 'enviando', erro: invalid ?? undefined }
      update([...draftRef.current, draft]); remaining--
      if (!invalid) void send(draft)
    }
    if (input.current) input.current.value = ''
  }
  async function remove(draft: Draft) {
    setError(null)
    try {
      if (draft.reserva) await cancelarAnexoCliente(draft.reserva)
      update(draftRef.current.filter(item => item.key !== draft.key))
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível remover.') }
  }
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold text-slate-950">Prints e anexos</h3><p className="mt-1 text-sm text-silver-600">Até 3 imagens JPG, PNG, WEBP ou HEIC, com no máximo 2 MB cada. Os arquivos são privados.</p></div>
      {query.isPending ? <p role="status" className="flex gap-2 text-sm text-silver-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando anexos…</p>
        : query.error ? <p role="alert" className="text-sm text-danger">{query.error.message}</p>
          : <div className="grid gap-3 sm:grid-cols-3">{query.data?.map(anexo => <AnexoThumb key={anexo.id} anexo={anexo} />)}</div>}
      {!query.isPending && !query.error && !query.data?.length && <p className="rounded-lg border border-dashed border-silver-300 p-4 text-sm text-silver-500">Nenhum print anexado ainda.</p>}
      {readOnly ? <p className="text-sm text-silver-500">Prospect convertido: os anexos estão disponíveis para consulta.</p> : (
        <div tabIndex={0} role="group" aria-label="Área para anexar ou colar prints"
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
          onDrop={event => { event.preventDefault(); select(Array.from(event.dataTransfer.files)) }}
          onPaste={event => { const files = Array.from(event.clipboardData.items).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter((file): file is File => Boolean(file)); if (files.length) { event.preventDefault(); select(files) } }}
          className="rounded-xl border-2 border-dashed border-red-200 bg-red-50/40 p-6 text-center focus:outline-none focus:ring-2 focus:ring-red-500">
          <Upload className="mx-auto h-7 w-7 text-red-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-950">Solte uma imagem ou cole seu print aqui</p>
          <input ref={input} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.heif" hidden onChange={event => select(Array.from(event.target.files ?? []))} />
          <button type="button" className="btn-no-liquid border border-silver-300 bg-white text-silver-800 hover:bg-silver-100 mt-4" disabled={busy || query.isPending || query.isError || (query.data?.length ?? 0) + drafts.length >= B2C_ANEXO_MAX} onClick={() => input.current?.click()}><Paperclip className="h-4 w-4" />Selecionar prints</button>
        </div>
      )}
      {drafts.map(draft => <div key={draft.key} className="rounded-lg border border-silver-200 bg-white p-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-slate-950">{draft.estado === 'enviando' ? <Loader2 className="h-4 w-4 animate-spin" /> : draft.estado === 'pronto' ? <Check className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-danger" />}<span className="break-all">{draft.file.name}</span><span className="shrink-0 text-xs text-silver-500">{Math.ceil(draft.file.size / 1024)} KB</span></p>
        <p aria-live="polite" className="mt-1 text-silver-600">{draft.estado === 'enviando' ? 'Enviando e confirmando…' : draft.estado === 'pronto' ? 'Anexado' : draft.erro}</p>
        {draft.estado === 'erro' && <div className="mt-2 flex gap-4">{!validarArquivoProspeccaoCliente(draft.file) && <button type="button" disabled={busy} className="btn-no-liquid font-semibold text-red-700 underline" onClick={() => void send(draft)}>Tentar novamente</button>}<button type="button" disabled={busy} className="btn-no-liquid font-semibold text-silver-700 underline" onClick={() => void remove(draft)}>Remover rascunho</button></div>}
      </div>)}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}

function AnexoThumb({ anexo }: { anexo: AnexoCliente }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    void urlAnexoCliente(anexo.storage_path).then(value => { if (live) setUrl(value) }).catch(() => undefined)
    return () => { live = false }
  }, [anexo.storage_path])
  async function open() {
    setBusy(true); setError(null)
    // Abre imediatamente para preservar o gesto do usuário contra bloqueadores de popup.
    const target = window.open('about:blank', '_blank')
    if (target) target.opener = null
    try { const signed = await urlAnexoCliente(anexo.storage_path); if (target) target.location.href = signed; else setError('Permita abrir uma nova aba para consultar o print.') }
    catch (failure) { target?.close(); setError(failure instanceof Error ? failure.message : 'Falha ao abrir.') }
    finally { setBusy(false) }
  }
  return <div className="rounded-lg border border-silver-200 bg-white p-2"><button type="button" disabled={busy} onClick={() => void open()} className="btn-no-liquid w-full flex-col items-stretch justify-start gap-0 p-0 text-left" aria-label={'Abrir print ' + anexo.nome}>
    {url && anexo.mime_type !== 'image/heic' ? <img className="h-28 w-full rounded-md object-cover" alt={anexo.nome} src={url} onError={() => setUrl(null)} /> : <div className="flex h-28 items-center justify-center rounded-md bg-silver-50 text-silver-500"><Paperclip className="h-6 w-6" /></div>}
    <span className="mt-2 block truncate text-xs font-semibold text-silver-700">{anexo.nome}</span><span className="text-xs text-silver-500">{Math.ceil(anexo.tamanho_bytes / 1024)} KB · Abrir print</span>
  </button>{error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}</div>
}

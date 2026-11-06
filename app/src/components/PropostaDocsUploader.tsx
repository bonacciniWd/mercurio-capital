import { useState, type DragEvent } from 'react'
import { FileText, Upload, X, CheckCircle2, AlertCircle, Loader2, ScanText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { TIPO_LABEL, categoriaForTipo, type DocCategoria, type DocumentoTipo } from '@/lib/documentos'

export type { DocumentoTipo, DocCategoria }

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif'
const MAX_BYTES = 20 * 1024 * 1024
const ACCEPTED_EXTENSIONS = new Set(ACCEPT.split(',').map((extension) => extension.slice(1)))

type Props = {
  propostaId: string
  /** Define quem é o uploader, gravado em `origem`. */
  origem: 'cliente' | 'parceiro'
  /** Quando informado, restringe os tipos exibidos no select. */
  tiposPermitidos?: DocumentoTipo[]
  className?: string
  /** Habilita seleção múltipla e fila para telas administrativas/parceiro. */
  enableBatchUpload?: boolean
  /** Chamado após upload/remoção bem-sucedidos (para revalidar checklists externos). */
  onChange?: () => void
}

type UploadQueueItem = {
  id: string
  file: File
  tipo: DocumentoTipo
  status: 'queued' | 'uploading' | 'success' | 'error'
  message?: string
  retryable: boolean
}

type DocRow = {
  id: string
  tipo: DocumentoTipo
  categoria: DocCategoria
  storage_path: string
  mime_type: string | null
  tamanho_bytes: number | null
  origem: string | null
  validado: boolean
  ocr_texto: string | null
  created_at: string
}

/** Roda OCR client-side em imagens e grava em proposta_documentos.ocr_texto. */
async function runOcrInBackground(docId: string, file: File) {
  try {
    if (!file.type.startsWith('image/')) return
    const { recognize } = await import('tesseract.js')
    const result = await recognize(file, 'por', { logger: () => {} })
    const texto = (result.data.text ?? '').trim()
    if (!texto) return
    await supabase.rpc('set_documento_ocr', { p_id: docId, p_texto: texto.slice(0, 10000) })
  } catch (err) {
    // OCR é best-effort; falha não bloqueia o upload
    console.warn('OCR falhou:', err)
  }
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ACCEPTED_EXTENSIONS.has(extension)) return 'Formato de arquivo não aceito.'
  if (file.size > MAX_BYTES) return 'Arquivo acima de 20 MB.'
  return null
}

function formatFileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
}

export function PropostaDocsUploader({ propostaId, origem, tiposPermitidos, className, enableBatchUpload = false, onChange }: Props) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [tipoSel, setTipoSel] = useState<DocumentoTipo>(tiposPermitidos?.[0] ?? 'comprovante_residencia')
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [isBatchUploading, setIsBatchUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const { data: docs, isLoading } = useQuery({
    queryKey: ['proposta-docs', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('id, tipo, categoria, storage_path, mime_type, tamanho_bytes, origem, validado, ocr_texto, created_at')
        .eq('proposta_id', propostaId)
        .not('storage_path', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as DocRow[]
    },
  })

  const uploadMut = useMutation({
    mutationFn: async ({ file, tipo }: { file: File; tipo: DocumentoTipo }) => {
      const validationError = validateFile(file)
      if (validationError) throw new Error(validationError)
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const categoria: DocCategoria = categoriaForTipo(tipo)
      const path = `${propostaId}/${categoria}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('proposta-docs')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(upErr.message)

      const { data: row, error: insErr } = await supabase
        .from('proposta_documentos')
        .insert({
          proposta_id: propostaId,
          tipo,
          categoria,
          storage_path: path,
          bucket: 'proposta-docs',
          mime_type: file.type,
          tamanho_bytes: file.size,
          origem,
          status: 'enviado',
        })
        .select('id')
        .single()

      if (insErr) {
        // rollback do storage para não deixar lixo
        await supabase.storage.from('proposta-docs').remove([path])
        throw new Error(insErr.message)
      }

      // OCR best-effort em background (não aguarda)
      void runOcrInBackground(row.id as string, file).finally(() => {
        qc.invalidateQueries({ queryKey: ['proposta-docs', propostaId] })
      })

      return row.id as string
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposta-docs', propostaId] }); onChange?.() },
  })

  const removeMut = useMutation({
    mutationFn: async (d: DocRow) => {
      const { error: delErr } = await supabase.from('proposta_documentos').delete().eq('id', d.id)
      if (delErr) throw new Error(delErr.message)
      await supabase.storage.from('proposta-docs').remove([d.storage_path])
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposta-docs', propostaId] }); onChange?.() },
    onError: (err) => setError(err instanceof Error ? err.message : 'Falha ao remover.'),
  })

  const tipos = tiposPermitidos ?? (Object.keys(TIPO_LABEL) as DocumentoTipo[])
  const isUploading = uploadMut.isPending || isBatchUploading

  const uploadFiles = (files: File[]) => {
    if (!enableBatchUpload) {
      const file = files[0]
      if (!file) return
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setError(null)
      void uploadMut.mutateAsync({ file, tipo: tipoSel }).catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Falha no upload.')
      })
      return
    }

    if (!files.length || isUploading) return
    setError(null)
    setUploadQueue((current) => [
      ...current,
      ...files.map((file) => {
        const validationError = validateFile(file)
        return {
          id: crypto.randomUUID(),
          file,
          tipo: tipoSel,
          status: validationError ? 'error' as const : 'queued' as const,
          message: validationError ?? undefined,
          retryable: false,
        }
      }),
    ])
  }

  const processQueue = async (items: UploadQueueItem[]) => {
    if (!items.length || isUploading) return
    setIsBatchUploading(true)
    for (const item of items) {
      setUploadQueue((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, status: 'uploading', message: undefined }
        : entry))
      try {
        await uploadMut.mutateAsync({ file: item.file, tipo: item.tipo })
        setUploadQueue((current) => current.map((entry) => entry.id === item.id
          ? { ...entry, status: 'success', retryable: false }
          : entry))
      } catch (cause) {
        setUploadQueue((current) => current.map((entry) => entry.id === item.id
          ? {
              ...entry,
              status: 'error',
              message: cause instanceof Error ? cause.message : 'Falha no upload.',
              retryable: true,
            }
          : entry))
      }
    }
    setIsBatchUploading(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!isUploading) uploadFiles(Array.from(event.dataTransfer.files))
  }

  const queuedFiles = uploadQueue.filter((item) => item.status === 'queued')
  const failedFiles = uploadQueue.filter((item) => item.status === 'error')

  return (
    <div className={cn('space-y-4', enableBatchUpload && 'proposal-docs-uploader--batch', className)}>
      <div
        data-testid="proposta-docs-dropzone"
        className={cn(
          enableBatchUpload
            ? 'proposal-docs-dropzone'
            : 'rounded-lg border-2 border-dashed border-silver-300 bg-silver-50 p-4 transition-colors',
          isDragging && (enableBatchUpload ? 'is-dragging' : 'border-gold bg-gold/10'),
        )}
        onDragEnter={enableBatchUpload ? (event) => { event.preventDefault(); setIsDragging(true) } : undefined}
        onDragOver={enableBatchUpload ? (event) => { event.preventDefault(); setIsDragging(true) } : undefined}
        onDragLeave={enableBatchUpload ? (event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
        } : undefined}
        onDrop={enableBatchUpload ? handleDrop : undefined}
      >
        {enableBatchUpload && (
          <svg
            className="upload-illustration"
            data-testid="upload-illustration"
            aria-hidden="true"
            viewBox="0 0 160 112"
            fill="none"
          >
            <ellipse className="upload-shadow" cx="80" cy="96" rx="35" ry="5" fill="#ef3f3a" />
            <circle className="upload-dot" cx="38" cy="27" r="3" fill="#ef3f3a" />
            <circle className="upload-dot upload-dot-two" cx="121" cy="20" r="2.5" fill="#ef3f3a" />
            <path d="M45 73h71c12 0 21-9 21-20 0-10-8-19-19-20-4-16-18-27-35-27-16 0-29 10-34 24-2-.5-4-.8-6-.8-13 0-23 10-23 22S30 73 45 73Z" stroke="#ef3f3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <g className="upload-arrow">
              <path d="M80 55V31m0 0-9 9m9-9 9 9" stroke="#ef3f3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g className="upload-file">
              <path d="M67 36a4 4 0 0 1 4-4h17l12 12v28a4 4 0 0 1-4 4H71a4 4 0 0 1-4-4V36Z" fill="white" stroke="#ef3f3a" strokeWidth="2" strokeLinejoin="round" />
              <path d="M88 32v13h12M74 60h19M74 66h15" stroke="#ef3f3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
        )}
        <div className={cn(enableBatchUpload && 'proposal-docs-dropzone__content')}>
        <p className={cn('mb-3 text-sm font-medium text-navy', enableBatchUpload && 'proposal-docs-dropzone__title')}>Enviar novo documento</p>
        {enableBatchUpload && <p className="proposal-docs-dropzone__intro">Arraste seus arquivos para esta área ou selecione diretamente do seu dispositivo.</p>}
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end', enableBatchUpload && 'proposal-docs-dropzone__controls')}>
          <label className={cn('grid gap-1 text-xs font-medium text-silver-600', enableBatchUpload && 'proposal-docs-dropzone__type')}>
            <span>{enableBatchUpload ? 'Tipo padrão para novos arquivos' : 'Tipo de documento'}</span>
            <select
              className={cn('rounded-md border border-silver-300 bg-white px-3 py-2 text-sm text-navy', enableBatchUpload && 'proposal-docs-select')}
              value={tipoSel}
              aria-label={enableBatchUpload ? 'Tipo padrão para novos arquivos' : 'Tipo de documento'}
              onChange={(e) => setTipoSel(e.target.value as DocumentoTipo)}
              disabled={isUploading}
            >
              {tipos.map((t) => (
                <option key={t} value={t}>{TIPO_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label
            className={cn(
              enableBatchUpload ? 'btn-no-liquid proposal-docs-picker' : 'btn-gold inline-flex cursor-pointer items-center gap-2 text-sm focus-within:ring-2 focus-within:ring-gold focus-within:ring-offset-2',
              isUploading && 'pointer-events-none opacity-60',
            )}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? 'Enviando…' : enableBatchUpload ? 'Selecionar arquivos' : 'Selecionar arquivo'}
            <input
              type="file"
              className={enableBatchUpload ? 'sr-only' : 'hidden'}
              accept={ACCEPT}
              multiple={enableBatchUpload}
              aria-label={enableBatchUpload ? 'Selecionar arquivos' : 'Selecionar arquivo'}
              disabled={isUploading}
              onChange={(e) => {
                if (e.target.files?.length) uploadFiles(Array.from(e.target.files))
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className={cn('mt-2 text-xs text-silver-500', enableBatchUpload && 'proposal-docs-dropzone__hint')}>
          {enableBatchUpload
            ? 'PDF, JPG, PNG, WEBP, HEIC ou HEIF. Até 20 MB por arquivo; revise os arquivos antes do envio.'
            : 'PDF, JPG, PNG ou WEBP — até 20 MB.'}
        </p>
        </div>
        {enableBatchUpload && uploadQueue.length > 0 && (
          <div className="proposal-docs-queue" aria-live="polite">
            <ul className="proposal-docs-queue__list divide-y divide-silver-200 rounded-md border border-silver-200 bg-white">
              {uploadQueue.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 sm:flex-1">
                    <p className="truncate text-sm font-medium text-navy" title={item.file.name}>{item.file.name}</p>
                    <p className="text-xs text-silver-500">{formatFileSize(item.file.size)}</p>
                  </div>
                  <label className="grid min-w-0 gap-1 text-xs font-medium text-silver-600 sm:w-56">
                    <span>Tipo deste arquivo</span>
                    <select
                      className="w-full rounded-md border border-silver-300 bg-white px-2 py-1.5 text-sm text-navy"
                      aria-label={`Tipo de documento para ${item.file.name}`}
                      value={item.tipo}
                      disabled={isUploading || item.status === 'success'}
                      onChange={(event) => setUploadQueue((current) => current.map((entry) => entry.id === item.id
                        ? { ...entry, tipo: event.target.value as DocumentoTipo }
                        : entry))}
                    >
                      {tipos.map((tipo) => <option key={tipo} value={tipo}>{TIPO_LABEL[tipo]}</option>)}
                    </select>
                  </label>
                  <div className="flex shrink-0 items-center gap-2 sm:min-w-36 sm:justify-end">
                    <p className={cn('text-xs', item.status === 'error' ? 'text-danger' : 'text-silver-500')}>
                      {item.status === 'queued' ? 'Aguardando envio' : item.status === 'uploading' ? 'Enviando…' : item.status === 'success' ? 'Enviado' : item.message}
                    </p>
                    {item.status === 'success' && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Enviado" />}
                    {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-gold" aria-label="Enviando" />}
                    {item.status === 'error' && item.retryable && (
                      <button type="button" className="btn-no-liquid text-xs text-danger" disabled={isUploading} onClick={() => void processQueue([{ ...item, status: 'queued', retryable: false }])}>
                        Tentar novamente
                      </button>
                    )}
                    {(item.status === 'queued' || item.status === 'error') && !isUploading && (
                      <button type="button" className="btn-no-liquid rounded-full p-1 text-silver-500 hover:text-danger" aria-label={`Remover ${item.file.name} da fila`} title="Remover da fila" onClick={() => setUploadQueue((current) => current.filter((entry) => entry.id !== item.id))}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {queuedFiles.length > 0 && (
              <button type="button" className="btn-no-liquid btn-gold" disabled={isUploading} onClick={() => void processQueue(queuedFiles)}>
                {isBatchUploading ? 'Enviando lote…' : `Enviar ${queuedFiles.length} ${queuedFiles.length === 1 ? 'arquivo' : 'arquivos'}`}
              </button>
            )}
            {failedFiles.length > 0 && !failedFiles.some((item) => item.retryable) && (
              <p className="text-xs text-danger">Revise os arquivos inválidos e selecione-os novamente após corrigir o problema.</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wide text-silver-500', enableBatchUpload && 'proposal-docs-list-title')}>
          Documentos enviados
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : !docs?.length ? (
          <p className={cn('rounded-md border border-silver-200 bg-white p-4 text-sm text-silver-500', enableBatchUpload && 'proposal-docs-empty')}>
            Nenhum documento enviado ainda.
          </p>
        ) : (
          <ul className={cn('divide-y divide-silver-100 rounded-md border border-silver-200 bg-white', enableBatchUpload && 'proposal-docs-list')}>
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-silver-500" />
                  <div>
                    <p className="text-sm font-medium text-navy">{TIPO_LABEL[d.tipo] || d.tipo}</p>
                    <p className="text-xs text-silver-500">
                      {new Date(d.created_at).toLocaleString('pt-BR')} · {d.origem || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.ocr_texto && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-medium text-navy"
                      title={d.ocr_texto.slice(0, 200)}
                    >
                      <ScanText className="h-3 w-3" /> OCR
                    </span>
                  )}
                  {d.validado ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprovado
                    </span>
                  ) : (
                    <span className="rounded-full bg-silver-100 px-2 py-0.5 text-xs text-silver-600">
                      Em análise
                    </span>
                  )}
                  {!d.validado && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-silver-500 hover:bg-silver-50 hover:text-danger disabled:opacity-50"
                      onClick={() => removeMut.mutate(d)}
                      disabled={removeMut.isPending}
                      aria-label="Remover"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

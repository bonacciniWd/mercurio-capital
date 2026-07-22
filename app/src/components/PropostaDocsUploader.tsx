import { useState } from 'react'
import { FileText, Upload, X, CheckCircle2, AlertCircle, Loader2, ScanText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { TIPO_LABEL, categoriaForTipo, type DocCategoria, type DocumentoTipo } from '@/lib/documentos'

export type { DocumentoTipo, DocCategoria }

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif'
const MAX_BYTES = 20 * 1024 * 1024

type Props = {
  propostaId: string
  /** Define quem é o uploader, gravado em `origem`. */
  origem: 'cliente' | 'parceiro'
  /** Quando informado, restringe os tipos exibidos no select. */
  tiposPermitidos?: DocumentoTipo[]
  className?: string
  /** Chamado após upload/remoção bem-sucedidos (para revalidar checklists externos). */
  onChange?: () => void
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

export function PropostaDocsUploader({ propostaId, origem, tiposPermitidos, className, onChange }: Props) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [tipoSel, setTipoSel] = useState<DocumentoTipo>(tiposPermitidos?.[0] ?? 'comprovante_residencia')

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
      if (file.size > MAX_BYTES) throw new Error('Arquivo acima de 20MB.')
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
    onError: (err) => setError(err instanceof Error ? err.message : 'Falha no upload.'),
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

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-lg border-2 border-dashed border-silver-300 bg-silver-50 p-4">
        <p className="mb-3 text-sm font-medium text-navy">Enviar novo documento</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            className="rounded-md border border-silver-300 bg-white px-3 py-2 text-sm"
            value={tipoSel}
            onChange={(e) => setTipoSel(e.target.value as DocumentoTipo)}
            disabled={uploadMut.isPending}
          >
            {tipos.map((t) => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </select>
          <label
            className={cn(
              'btn-gold inline-flex cursor-pointer items-center gap-2 text-sm',
              uploadMut.isPending && 'pointer-events-none opacity-60',
            )}
          >
            {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadMut.isPending ? 'Enviando…' : 'Selecionar arquivo'}
            <input
              type="file"
              className="hidden"
              accept={ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setError(null)
                  uploadMut.mutate({ file: f, tipo: tipoSel })
                }
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-silver-500">PDF, JPG, PNG ou WEBP — até 20MB.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-silver-500">
          Documentos enviados
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : !docs?.length ? (
          <p className="rounded-md border border-silver-200 bg-white p-4 text-sm text-silver-500">
            Nenhum documento enviado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-silver-100 rounded-md border border-silver-200 bg-white">
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

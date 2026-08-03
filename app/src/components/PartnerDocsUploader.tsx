import { useState } from 'react'
import { FileText, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export type DocumentoTipo =
  | 'rg'
  | 'cpf'
  | 'cnh'
  | 'cnh_ou_rg'
  | 'certidao_estado_civil'
  | 'contrato_social'
  | 'comprovante_residencia'
  | 'comprovante_renda'
  | 'dados_bancarios'
  | 'outros'

export type DocSlot = {
  tipo: DocumentoTipo
  label: string
  required?: boolean
  hint?: string
}

type UploadedDoc = {
  id: string
  tipo: DocumentoTipo
  storagePath: string
  fileName: string
}

type Props = {
  partnerId: string
  slots: DocSlot[]
  /** Chamado quando todos os slots required estão preenchidos. */
  onComplete?: (docs: UploadedDoc[]) => void
  className?: string
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp'
const MAX_BYTES = 10 * 1024 * 1024

export function PartnerDocsUploader({ partnerId, slots, onComplete, className }: Props) {
  const [uploads, setUploads] = useState<Record<DocumentoTipo, UploadedDoc | undefined>>(
    {} as Record<DocumentoTipo, UploadedDoc | undefined>,
  )
  const [busy, setBusy] = useState<DocumentoTipo | null>(null)
  const [error, setError] = useState<string | null>(null)

  function notifyIfComplete(next: Record<DocumentoTipo, UploadedDoc | undefined>) {
    const allOk = slots
      .filter((s) => s.required)
      .every((s) => Boolean(next[s.tipo]))
    if (allOk && onComplete) {
      onComplete(Object.values(next).filter(Boolean) as UploadedDoc[])
    }
  }

  async function handleFile(slot: DocSlot, file: File) {
    setError(null)
    if (file.size > MAX_BYTES) {
      setError(`${slot.label}: arquivo acima de 10MB.`)
      return
    }
    setBusy(slot.tipo)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${partnerId}/${slot.tipo}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('partner_docs')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (upErr) throw new Error(upErr.message)

      const { data: row, error: insErr } = await supabase
        .from('partner_documentos')
        .insert({
          partner_id: partnerId,
          tipo: slot.tipo,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        })
        .select('id')
        .single()

      if (insErr) throw new Error(insErr.message)

      const next = {
        ...uploads,
        [slot.tipo]: { id: row.id, tipo: slot.tipo, storagePath: path, fileName: file.name },
      }
      setUploads(next)
      notifyIfComplete(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(slot: DocSlot) {
    const current = uploads[slot.tipo]
    if (!current) return
    setBusy(slot.tipo)
    setError(null)
    try {
      await supabase.from('partner_documentos').delete().eq('id', current.id)
      await supabase.storage.from('partner_docs').remove([current.storagePath])
      const next = { ...uploads, [slot.tipo]: undefined }
      setUploads(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {slots.map((slot) => {
        const uploaded = uploads[slot.tipo]
        const isBusy = busy === slot.tipo
        return (
          <div
            key={slot.tipo}
            className={cn(
              'rounded-lg border-2 border-dashed p-4 transition',
              uploaded ? 'border-success/30 bg-success/5' : 'border-silver-300 bg-silver-50',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {uploaded ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                ) : (
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-silver-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-navy">
                    {slot.label}
                    {slot.required && <span className="ml-1 text-danger">*</span>}
                  </p>
                  {uploaded ? (
                    <p className="text-xs text-silver-600">{uploaded.fileName}</p>
                  ) : (
                    slot.hint && <p className="text-xs text-silver-500">{slot.hint}</p>
                  )}
                </div>
              </div>

              {uploaded ? (
                <button
                  type="button"
                  onClick={() => handleRemove(slot)}
                  disabled={isBusy}
                  className="rounded-md p-1 text-silver-500 hover:bg-white hover:text-danger disabled:opacity-50"
                  aria-label="Remover arquivo"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <label
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-navy ring-1 ring-silver-300 hover:bg-silver-100',
                    isBusy && 'pointer-events-none opacity-50',
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {isBusy ? 'Enviando...' : 'Selecionar'}
                  <input
                    type="file"
                    className="hidden"
                    accept={ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleFile(slot, f)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )
      })}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-silver-500">
        PDF, JPG, PNG ou WEBP — até 10MB por arquivo. Os documentos são privados e visíveis apenas para você e
        nossa equipe de aprovação.
      </p>
    </div>
  )
}

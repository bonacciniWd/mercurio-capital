// Anexos de prospecção (issue #38): validação client + upload em 2 fases +
// leitura por signed URL 300s. Espelha propostaObservacaoAnexo.ts (mesmo padrão).
import { supabase } from '@/lib/supabase'
import { mapearErroProspeccao } from '@/lib/prospeccao'

export const PROSPECCAO_ANEXO_TTL_SECONDS = 60 * 5
export const PROSPECCAO_ANEXO_MAX_BYTES = 2 * 1024 * 1024
export const PROSPECCAO_MAX_ANEXOS = 3

const MIME_POR_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heic',
}

export function validarArquivoProspeccao(file: { name: string; size: number; type: string }): string | null {
  if (!file.name.includes('.')) return 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.'
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  const mimeEsperado = MIME_POR_EXT[ext]
  if (!mimeEsperado) return 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.'
  if (file.type && file.type !== mimeEsperado) return 'O tipo do arquivo não corresponde à extensão.'
  if (file.size <= 0 || file.size > PROSPECCAO_ANEXO_MAX_BYTES) return 'O print deve ter no máximo 2 MB.'
  return null
}

type PrepararResult = { data: { anexo_id: string; bucket: string; storage_path: string }[] | null; error: { message?: string; code?: string } | null }

// preparar → upload → confirmar. Retorna anexo_id. Falha aborta sem vínculo.
export async function uploadProspeccaoAnexo(prospeccaoId: string, file: File): Promise<string> {
  const invalido = validarArquivoProspeccao(file)
  if (invalido) throw new Error(invalido)

  const ext = file.name.toLowerCase().split('.').pop()!
  const mime = MIME_POR_EXT[ext]

  const { data, error } = await supabase.rpc('admin_prospeccao_anexo_preparar', {
    p_prospeccao_id: prospeccaoId,
    p_nome: file.name,
    p_mime_type: mime,
    p_tamanho_bytes: file.size,
  }) as unknown as PrepararResult
  if (error || !data?.[0]) throw new Error(mapearErroProspeccao(error?.code, error?.message))

  const { bucket, storage_path, anexo_id } = data[0]
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storage_path, file, { contentType: mime, upsert: false })
  if (uploadError) throw new Error('Falha ao enviar o print. Tente novamente.')

  const { error: confirmaError } = await supabase.rpc('admin_prospeccao_anexo_confirmar', { p_anexo_id: anexo_id })
  if (confirmaError) throw new Error(mapearErroProspeccao(confirmaError.code, confirmaError.message))

  return anexo_id
}

type SignedUrlResult = { data: { signedUrl?: string } | null; error: { message?: string } | null }
export type ProspeccaoAnexoSigner = (bucket: 'prospeccao-anexos', storagePath: string, expiresIn: number) => Promise<SignedUrlResult>

const defaultSigner: ProspeccaoAnexoSigner = async (bucket, storagePath, expiresIn) => (
  supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
)

export async function createProspeccaoAnexoSignedUrl(
  storagePath: string,
  signer: ProspeccaoAnexoSigner = defaultSigner,
): Promise<string> {
  const normalizedPath = storagePath.trim()
  if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
    throw new Error('Caminho do anexo inválido.')
  }
  const { data, error } = await signer('prospeccao-anexos', normalizedPath, PROSPECCAO_ANEXO_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Não foi possível gerar o acesso seguro ao anexo.')
  }
  return data.signedUrl
}

export function openProspeccaoAnexo(signedUrl: string, openWindow: typeof window.open = window.open.bind(window)): void {
  const opened = openWindow(signedUrl, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
}

// Anexos de observações do Kanban (issue #21): validação client-side (espelho do
// server), upload em 2 fases (preparar RPC → PUT no storage) e leitura por
// signed URL de 300s (A02). Espelha propostaDocumento.ts.
import { supabase } from '@/lib/supabase'

export const PROPOSTA_OBS_ANEXO_TTL_SECONDS = 60 * 5
export const PROPOSTA_OBS_ANEXO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB (S1 do dono)
export const PROPOSTA_OBS_MAX_ANEXOS = 3 // S2 confirmada pelo dono

const MIME_POR_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
}

// Validação client-side (UX antecipada; a autoridade é o server: RPC + bucket).
export function validarArquivoObservacao(file: { name: string; size: number; type: string }): string | null {
  // exige extensão real ('png' sem ponto não passa — o server também rejeita)
  if (!file.name.includes('.')) return 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.'
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  const mimeEsperado = MIME_POR_EXT[ext]
  if (!mimeEsperado) return 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.'
  if (file.type && file.type !== mimeEsperado) return 'O tipo do arquivo não corresponde à extensão.'
  if (file.size <= 0 || file.size > PROPOSTA_OBS_ANEXO_MAX_BYTES) return 'O print deve ter no máximo 2 MB.'
  return null
}

type PrepararResult = {
  data: { anexo_id: string; bucket: string; storage_path: string }[] | null
  error: { message?: string } | null
}

type Deps = {
  preparar?: (args: { p_proposta_id: string; p_nome: string; p_mime_type: string; p_tamanho_bytes: number }) => Promise<PrepararResult>
  upload?: (bucket: string, path: string, file: File | Blob, contentType: string) => Promise<{ error: { message?: string } | null }>
}

// Fase 1 (RPC preparar) + fase 2 (upload no bucket). Retorna o anexo_id para
// vincular na criação da observação. Qualquer falha aborta sem resíduo vinculado.
export async function uploadObservacaoAnexo(
  propostaId: string,
  file: File,
  deps: Deps = {},
): Promise<string> {
  const invalido = validarArquivoObservacao(file)
  if (invalido) throw new Error(invalido)

  const preparar = deps.preparar ?? ((args) => supabase.rpc('proposta_obs_anexo_preparar', args) as unknown as Promise<PrepararResult>)
  const upload = deps.upload ?? ((bucket, path, f, contentType) =>
    supabase.storage.from(bucket).upload(path, f, { contentType, upsert: false }))

  const ext = file.name.toLowerCase().split('.').pop()!
  const mime = MIME_POR_EXT[ext]

  const { data, error } = await preparar({
    p_proposta_id: propostaId,
    p_nome: file.name,
    p_mime_type: mime,
    p_tamanho_bytes: file.size,
  })
  if (error || !data?.[0]) throw erroObservacao(error?.message, error)

  const { bucket, storage_path, anexo_id } = data[0]
  const { error: uploadError } = await upload(bucket, storage_path, file, mime)
  if (uploadError) throw new Error('Falha ao enviar o print. Tente novamente.')

  return anexo_id
}

// ---------------- leitura segura ----------------

type SignedUrlResult = { data: { signedUrl?: string } | null; error: { message?: string } | null }
export type ObservacaoAnexoSigner = (bucket: 'proposta-obs', storagePath: string, expiresIn: number) => Promise<SignedUrlResult>

const defaultSigner: ObservacaoAnexoSigner = async (bucket, storagePath, expiresIn) => (
  supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
)

export async function createObservacaoAnexoSignedUrl(
  storagePath: string,
  signer: ObservacaoAnexoSigner = defaultSigner,
): Promise<string> {
  const normalizedPath = storagePath.trim()
  if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
    throw new Error('Caminho do anexo inválido.')
  }

  const { data, error } = await signer('proposta-obs', normalizedPath, PROPOSTA_OBS_ANEXO_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Não foi possível gerar o acesso seguro ao anexo.')
  }
  return data.signedUrl
}

export function openObservacaoAnexo(
  signedUrl: string,
  openWindow: typeof window.open = window.open.bind(window),
): void {
  const opened = openWindow(signedUrl, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
}

// Erro mapeado com o PostgrestError original preservado em .cause
// (o tsconfig não tem lib ES2022.Error — atribuição manual em vez do 2º arg).
export function erroObservacao(raw: string | undefined, cause: unknown): Error {
  const err = new Error(mapearErroObservacao(raw))
  ;(err as Error & { cause?: unknown }).cause = cause
  return err
}

// Mensagens da RPC → pt-BR amigável (códigos do modelo 20261111000003).
// Nota: PostgREST devolve o SQLSTATE em error.code (não em message) — mapear por
// substring da message apenas, e propagar o erro original via { cause } nos call sites.
export function mapearErroObservacao(raw?: string): string {
  const msg = raw ?? ''
  if (msg.includes('janela_edicao_expirada')) return 'A edição/remoção só é permitida nos primeiros 15 minutos.'
  if (msg.includes('maximo_3_anexos')) return 'Máximo de 3 prints por observação.'
  if (msg.includes('tamanho_invalido')) return 'O print deve ter no máximo 2 MB.'
  if (msg.includes('mime_invalido')) return 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.'
  if (msg.includes('extensao_incoerente')) return 'O tipo do arquivo não corresponde à extensão.'
  if (msg.includes('anexo_invalido_ou_expirado')) return 'Anexo expirado ou inválido. Anexe novamente.'
  if (msg.includes('fora_do_escopo')) return 'Você não tem acesso a esta proposta.'
  if (msg.includes('observacao_indisponivel') || msg.includes('proposta_inexistente')) {
    return 'Esta observação não está mais disponível. Atualize a timeline.'
  }
  if (msg.includes('corpo_invalido')) return 'O comentário precisa ter entre 1 e 4.000 caracteres.'
  if (msg.includes('motivo_obrigatorio')) return 'Informe o motivo da remoção.'
  return 'Não foi possível concluir. Tente novamente.'
}

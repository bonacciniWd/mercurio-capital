import { supabase } from '@/lib/supabase'
import { validarArquivoProspeccao } from '@/lib/prospeccaoAnexo'

export { validarArquivoProspeccao as validarArquivoProspeccaoCliente }
export const B2C_ANEXO_BUCKET = 'prospeccao-clientes-anexos'
export const B2C_ANEXO_MAX = 3
export type ReservaAnexoCliente = { anexo_id: string; bucket: string; storage_path: string }

export function erroAnexoCliente(error: { code?: string; message?: string }): string {
  const message = error.message ?? ''
  if (error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205') return 'Anexos indisponíveis: a atualização do banco ainda precisa ser publicada.'
  if (message.includes('maximo_3_anexos')) return 'Cada prospect permite até 3 prints (incluindo envios em andamento).'
  if (message.includes('reserva_expirada')) return 'O prazo deste envio expirou. Remova o rascunho e selecione o print novamente.'
  if (message.includes('tamanho_invalido')) return 'O print deve ter no máximo 2 MB.'
  if (message.includes('anexo_sem_objeto_valido')) return 'O arquivo enviado não foi confirmado. Tente novamente.'
  if (message.includes('anexo_ja_recebido')) return 'Este print já está anexado; atualize a lista.'
  if (error.code === '42501') return 'Seu acesso ao prospect mudou ou é necessário concluir a verificação 2FA.'
  return 'Não foi possível enviar o print. Tente novamente.'
}

function mimeArquivo(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return file.type || (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'heif' ? 'image/heic' : 'image/' + ext)
}

export async function prepararAnexoCliente(id: string, file: File): Promise<ReservaAnexoCliente> {
  const invalid = validarArquivoProspeccao(file)
  if (invalid) throw new Error(invalid)
  const mime = mimeArquivo(file)
  const { data, error } = await supabase.rpc('prospeccao_cliente_anexo_preparar', {
    p_prospeccao_id: id, p_nome: file.name, p_mime_type: mime, p_tamanho_bytes: file.size,
  })
  if (error) throw new Error(erroAnexoCliente(error))
  const reservation = (data as ReservaAnexoCliente[] | null)?.[0]
  if (!reservation || reservation.bucket !== B2C_ANEXO_BUCKET) throw new Error('Não foi possível reservar o envio.')
  return reservation
}

export async function enviarAnexoCliente(reserva: ReservaAnexoCliente, file: File): Promise<void> {
  // Retentativa reutiliza a reserva. Confirma primeiro: a resposta anterior pode ter se perdido.
  const result = await supabase.rpc('prospeccao_cliente_anexo_confirmar', { p_anexo_id: reserva.anexo_id })
  if (!result.error) return
  if (!result.error.message?.includes('anexo_sem_objeto_valido')) throw new Error(erroAnexoCliente(result.error))
  const { error: uploadError } = await supabase.storage.from(B2C_ANEXO_BUCKET).upload(reserva.storage_path, file, { upsert: false, contentType: mimeArquivo(file) })
  if (uploadError) throw new Error('Falha ao enviar o print. Tente novamente; o envio não foi confirmado.')
  const { error } = await supabase.rpc('prospeccao_cliente_anexo_confirmar', { p_anexo_id: reserva.anexo_id })
  if (error) throw new Error(erroAnexoCliente(error))
}

export async function cancelarAnexoCliente(reserva: ReservaAnexoCliente) {
  const { error: storageError } = await supabase.storage.from(B2C_ANEXO_BUCKET).remove([reserva.storage_path])
  if (storageError) throw new Error('Não foi possível remover o rascunho. Tente novamente.')
  const { error } = await supabase.rpc('prospeccao_cliente_anexo_cancelar', { p_anexo_id: reserva.anexo_id })
  if (error) throw new Error(erroAnexoCliente(error))
}

export async function urlAnexoCliente(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(B2C_ANEXO_BUCKET).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir o print. Atualize e tente novamente.')
  return data.signedUrl
}

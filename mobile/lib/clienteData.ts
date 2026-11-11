import { useQuery } from '@tanstack/react-query'
import { useAuth } from './auth'
import { supabase } from './supabase'
import { priorizarPropostas } from './clientePresentation'
import type { DocCategoria, DocumentoTipo, RequisitoRow } from './documentos'

export interface ClientProposal {
  id: string; protocolo: string; produto: string; status: string; updated_at: string
  valor_solicitado: number | string | null; prazo_meses: number | null; taxa_juros_mensal: number | string | null
  cliente_id: string; cliente: { pessoa_tipo: 'PF' | 'PJ'; nome_completo: string; razao_social: string | null } | null
}
export interface ClientFile {
  id: string; proposta_id: string; categoria: DocCategoria; tipo: DocumentoTipo; bucket: string; storage_path: string
  nome: string; status: string; versao: number; created_at: string; cliente_id: string | null; cliente_documento_versao_id: string | null
}
export interface ClientRequest {
  id: string; proposta_id: string; protocolo: string; descricao: string; documento_solicitado_tipo: DocumentoTipo | null
  status: string; prazo: string | null; created_at: string
}
export interface ClientArchive { arquivos: ClientFile[]; solicitacoes: ClientRequest[] }
export function useClientProposals() {
  const { session } = useAuth()
  return useQuery({ queryKey: ['client', session?.userId, 'proposals'], enabled: session?.role === 'client', queryFn: async () => {
    const { data, error } = await supabase.from('propostas').select('id, protocolo, produto, status, updated_at, valor_solicitado, prazo_meses, taxa_juros_mensal, cliente_id, cliente:clientes(pessoa_tipo,nome_completo,razao_social)').order('updated_at', { ascending: false })
    if (error) throw error
    return priorizarPropostas((data ?? []) as unknown as ClientProposal[])
  } })
}
export function useClientArchive() {
  const { session } = useAuth()
  return useQuery({ queryKey: ['client', session?.userId, 'archive'], enabled: session?.role === 'client', retry: 1, queryFn: async (): Promise<ClientArchive> => {
    const { data, error } = await supabase.rpc('cliente_acervo_obter')
    if (error) throw error
    return data as ClientArchive
  } })
}
export function useClientRequirements() {
  return useQuery({ queryKey: ['client-requirements'], queryFn: async () => {
    const { data, error } = await supabase.from('documento_requisitos').select('categoria,tipo,obrigatorio,ordem').order('ordem')
    if (error) throw error
    return (data ?? []) as RequisitoRow[]
  } })
}
export function uniqueFiles(files: ClientFile[]): ClientFile[] {
  const seen = new Set<string>()
  return files.filter(file => { const key = `${file.bucket}:${file.storage_path}`; if (seen.has(key)) return false; seen.add(key); return true })
}
export const documentRoute = (propostaId?: string, pedido?: string) => ({ pathname: '/(cliente)/documentos' as const, params: { ...(propostaId ? { proposta: propostaId } : {}), ...(pedido ? { pedido } : {}) } })

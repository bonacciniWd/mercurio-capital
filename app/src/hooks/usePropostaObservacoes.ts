// Hook de dados das observações por proposta (issue #21): timeline, CRUD com
// invalidação e contagem em lote para os badges do Kanban.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { erroObservacao } from '@/lib/propostaObservacaoAnexo'

export type ObservacaoAnexo = {
  id: string
  nome: string
  mime_type: string
  tamanho_bytes: number
  storage_path: string
}

export type PropostaObservacao = {
  id: string
  autor_id: string
  autor_nome: string
  autor_papel: 'admin' | 'partner' | 'team_member'
  corpo: string
  etapa_snapshot: string
  editado_em: string | null
  created_at: string
  anexos: ObservacaoAnexo[]
}

export const OBS_QUERY_PREFIX = ['proposta-observacoes'] as const

export function usePropostaObservacoes(propostaId: string | null) {
  return useQuery({
    queryKey: [...OBS_QUERY_PREFIX, propostaId],
    enabled: Boolean(propostaId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('proposta_observacoes_listar', { p_proposta_id: propostaId })
      if (error) throw erroObservacao(error.message, error)
      return (data ?? []) as PropostaObservacao[]
    },
  })
}

export function usePropostaObservacaoContagem(propostaIds: string[]) {
  const key = [...propostaIds].sort()
  return useQuery({
    queryKey: [...OBS_QUERY_PREFIX, 'contagem', key],
    enabled: key.length > 0,
    staleTime: 45_000,
    refetchInterval: 45_000, // mesmo ciclo do Kanban (refetch real, não só stale)
    queryFn: async () => {
      const { data, error } = await supabase.rpc('proposta_observacao_contagem', { p_proposta_ids: key })
      if (error) throw erroObservacao(error.message, error)
      const map: Record<string, number> = {}
      for (const row of (data ?? []) as { proposta_id: string; total: number }[]) {
        map[row.proposta_id] = Number(row.total)
      }
      return map
    },
  })
}

function useInvalidar(qc: ReturnType<typeof useQueryClient>, propostaId: string) {
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: [...OBS_QUERY_PREFIX, propostaId] }),
    qc.invalidateQueries({ queryKey: [...OBS_QUERY_PREFIX, 'contagem'] }),
  ])
}

export function useObservacaoCriar(propostaId: string) {
  const qc = useQueryClient()
  const invalidar = useInvalidar(qc, propostaId)
  return useMutation({
    mutationFn: async ({ corpo, anexoIds }: { corpo: string; anexoIds: string[] }) => {
      const { error } = await supabase.rpc('proposta_observacao_criar', {
        p_proposta_id: propostaId,
        p_corpo: corpo,
        p_anexo_ids: anexoIds,
      })
      if (error) throw erroObservacao(error.message, error)
    },
    onSuccess: invalidar,
  })
}

export function useObservacaoEditar(propostaId: string) {
  const qc = useQueryClient()
  const invalidar = useInvalidar(qc, propostaId)
  return useMutation({
    mutationFn: async ({ id, corpo }: { id: string; corpo: string }) => {
      const { error } = await supabase.rpc('proposta_observacao_editar', { p_id: id, p_corpo: corpo })
      if (error) throw erroObservacao(error.message, error)
    },
    onSuccess: invalidar,
  })
}

export function useObservacaoRemover(propostaId: string) {
  const qc = useQueryClient()
  const invalidar = useInvalidar(qc, propostaId)
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { error } = await supabase.rpc('proposta_observacao_remover', { p_id: id, p_motivo: motivo ?? null })
      if (error) throw erroObservacao(error.message, error)
    },
    onSuccess: invalidar,
  })
}

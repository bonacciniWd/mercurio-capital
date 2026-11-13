// Hooks de anexos do funil de prospecção (issue #34 sobre o DB da #38):
// listagem por card via RPC admin_prospeccao_anexos_listar e contagem em lote
// para os cards do board (select direto coberto pela policy admin_le_prospeccao_anexos).
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { mapearErroProspeccao } from '@/lib/prospeccao'
import { PROSPECCOES_QUERY_KEY } from '@/hooks/useProspeccoes'

export type ProspeccaoAnexo = {
  id: string
  nome: string
  mime_type: string
  tamanho_bytes: number
  storage_path: string
  created_at: string
}

// Filho de PROSPECCOES_QUERY_KEY: qualquer invalidação do board cascateia para cá.
export const PROSPECCAO_ANEXOS_QUERY_PREFIX = [...PROSPECCOES_QUERY_KEY, 'anexos'] as const

export function useProspeccaoAnexos(prospeccaoId: string | null) {
  return useQuery({
    queryKey: [...PROSPECCAO_ANEXOS_QUERY_PREFIX, 'lista', prospeccaoId],
    enabled: Boolean(prospeccaoId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_prospeccao_anexos_listar', { p_prospeccao_id: prospeccaoId! })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
      return (data ?? []) as ProspeccaoAnexo[]
    },
  })
}

// Contagem de anexos recebidos por card (rodapé do card no board — Paperclip + total).
export function useProspeccaoAnexoContagem(prospeccaoIds: string[]) {
  const key = [...prospeccaoIds].sort()
  return useQuery({
    queryKey: [...PROSPECCAO_ANEXOS_QUERY_PREFIX, 'contagem', key],
    enabled: key.length > 0,
    staleTime: 45_000,
    refetchInterval: 45_000, // mesmo ciclo do board
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospeccoes_parceiro_anexos')
        .select('prospeccao_id')
        .eq('estado', 'recebido')
        .in('prospeccao_id', key)
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
      const map: Record<string, number> = {}
      for (const row of (data ?? []) as { prospeccao_id: string }[]) {
        map[row.prospeccao_id] = (map[row.prospeccao_id] ?? 0) + 1
      }
      return map
    },
  })
}

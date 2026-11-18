import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { erroAnexoCliente } from '@/lib/prospeccaoClienteAnexo'
import { PROSPECCOES_CLIENTES_QUERY_KEY } from '@/hooks/useProspeccoesClientes'

export const B2C_ANEXOS_QUERY_KEY = [...PROSPECCOES_CLIENTES_QUERY_KEY, 'anexos'] as const
export type AnexoCliente = { id: string; prospeccao_id: string; nome: string; mime_type: string; tamanho_bytes: number; storage_path: string; created_at: string }
export function useProspeccaoClienteAnexos(ids: string[]) {
  return useQuery({
    queryKey: [...B2C_ANEXOS_QUERY_KEY, [...ids].sort()], enabled: ids.length > 0,
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('prospeccoes_clientes_anexos')
        .select('id, prospeccao_id, nome, mime_type, tamanho_bytes, storage_path, created_at')
        .in('prospeccao_id', ids).eq('estado', 'recebido').is('deleted_at', null).order('created_at')
      if (error) throw new Error(erroAnexoCliente(error))
      return (data ?? []) as AnexoCliente[]
    },
  })
}

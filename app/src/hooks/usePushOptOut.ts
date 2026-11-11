// Lê usuarios.push_opt_out (policy usuario_le_proprio) com cache React Query.
// Invalidado/atualizado após push_preferencia_set. Compartilhado por
// PushBrowserSection, PushClientCard e as matrizes de preferências.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function usePushOptOut(userId: string | undefined) {
  return useQuery({
    queryKey: ['push', 'pref', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('push_opt_out')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data?.push_opt_out === true
    },
  })
}


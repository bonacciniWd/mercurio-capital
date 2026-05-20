import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'

export interface FeatureFlagRow {
  id: string
  chave: string
  descricao: string | null
  regras: { roles?: string[]; partner_ids?: string[]; percent?: number }
  ativo: boolean
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('id,chave,descricao,regras,ativo')
      if (error) throw error
      return (data ?? []) as FeatureFlagRow[]
    },
    staleTime: 60_000,
  })
}

function evaluate(flag: FeatureFlagRow, role?: string | null, partnerId?: string | null): boolean {
  if (!flag.ativo) return false
  const r = flag.regras ?? {}
  if (r.roles && r.roles.length > 0 && (!role || !r.roles.includes(role))) return false
  if (r.partner_ids && r.partner_ids.length > 0 && (!partnerId || !r.partner_ids.includes(partnerId))) return false
  if (typeof r.percent === 'number' && r.percent < 100) {
    // simple deterministic bucket based on user role+chave hash
    const seed = (role ?? 'anon') + ':' + flag.chave
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    if ((h % 100) >= r.percent) return false
  }
  return true
}

export function useFeatureFlag(chave: string): boolean {
  const { data } = useFeatureFlags()
  const { session } = useAuth()
  const flag = data?.find(f => f.chave === chave)
  if (!flag) return false
  const role = session?.role ?? null
  const partnerId = session?.partnerId ?? null
  return evaluate(flag, role, partnerId)
}

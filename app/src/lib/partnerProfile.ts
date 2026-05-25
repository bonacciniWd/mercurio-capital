import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type PartnerProfile = {
  usuario_id: string
  nome: string | null
  email: string | null
  telefone: string | null
  telefone_ddi: string | null
  avatar_url: string | null
  partner_id: string | null
  partner_status: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  razao_social: string | null
  cpf: string | null
  website: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  comissao_percentual: number | null
}

export const PARTNER_PROFILE_QUERY_KEY = ['partner', 'profile'] as const

export async function fetchPartnerProfile(): Promise<PartnerProfile> {
  const { data, error } = await supabase.rpc('partner_get_profile')
  if (error) throw error
  return (data ?? {}) as PartnerProfile
}

export function usePartnerProfile(): UseQueryResult<PartnerProfile> {
  return useQuery({
    queryKey: PARTNER_PROFILE_QUERY_KEY,
    queryFn: fetchPartnerProfile,
    staleTime: 60_000,
  })
}

const PARTNER_STATUS_LABEL: Record<NonNullable<PartnerProfile['partner_status']>, string> = {
  pending: 'Aguardando',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
}

export function partnerStatusLabel(s: PartnerProfile['partner_status']): string {
  return s ? PARTNER_STATUS_LABEL[s] : 'Parceiro'
}

export function partnerDisplayName(p: Partial<PartnerProfile> | null | undefined): string {
  if (!p) return 'Parceiro'
  return (p.razao_social && p.razao_social.trim()) || (p.nome && p.nome.trim()) || 'Parceiro'
}

export function partnerAvatarInitial(p: Partial<PartnerProfile> | null | undefined): string {
  const name = partnerDisplayName(p)
  return name.charAt(0).toUpperCase()
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

// ─── Labels compartilhados ──────────────────────────────────────────────────
export const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de Crédito',
  analise_imovel: 'Análise de Imóvel',
  analise_juridica: 'Análise Jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Proposta ao Cliente',
  resolucao_pendencias: 'Pré-análise',
  emissao_contrato: 'Emissão de Contrato',
  aguardando_assinatura: 'Aguardando Assinatura',
  em_registro: 'Em Registro',
  contrato_registrado: 'Contrato Registrado',
  recurso_liberado: 'Recurso Liberado',
  cancelado: 'Cancelado',
}

export const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

export const STATUS_FINAIS = new Set(['contrato_registrado', 'recurso_liberado', 'cancelado'])
export const STATUS_AGUARDANDO_CLIENTE = new Set([
  'proposta_cliente',
  'resolucao_pendencias',
  'aguardando_assinatura',
])

// ─── Tipos comuns ───────────────────────────────────────────────────────────
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

export function usePartnerProfile() {
  return useQuery({
    queryKey: PARTNER_PROFILE_QUERY_KEY,
    queryFn: async (): Promise<PartnerProfile> => {
      const { data, error } = await supabase.rpc('partner_get_profile')
      if (error) throw error
      return (data ?? {}) as PartnerProfile
    },
    staleTime: 60_000,
  })
}

export function partnerDisplayName(p: Partial<PartnerProfile> | null | undefined): string {
  if (!p) return 'Parceiro'
  return (p.razao_social && p.razao_social.trim()) || (p.nome && p.nome.trim()) || 'Parceiro'
}

// ─── Helpers ────────────────────────────────────────────────────────────────
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const dias = Math.floor(h / 24)
  if (dias < 30) return `há ${dias}d`
  return d.toLocaleDateString('pt-BR')
}

export function diasParado(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}


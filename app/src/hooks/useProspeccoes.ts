// Hook de dados do funil de prospecção (issue #34): board + histórico + CRUD
// com invalidação. Lê a view v_admin_prospeccoes_parceiro (security_invoker).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { mapearErroProspeccao, type ProspeccaoOrigem, type ProspeccaoStatus } from '@/lib/prospeccao'

export type ProspeccaoCard = {
  id: string
  nome_empresa: string
  contato_nome: string
  contato_email: string | null
  contato_telefone: string | null
  origem: ProspeccaoOrigem
  notas: string | null
  status: ProspeccaoStatus
  responsavel_id: string | null
  responsavel_nome: string | null
  proxima_acao_em: string | null
  partner_id: string | null
  proposta_id: string | null
  arquivado_em: string | null
  motivo_arquivamento: string | null
  created_at: string
  updated_at: string
}

export type ProspeccaoHistoricoItem = {
  id: string
  status_anterior: ProspeccaoStatus | null
  status_novo: ProspeccaoStatus
  alterado_em: string
  alterado_por: string | null
  autor_nome: string | null
}

export const PROSPECCOES_QUERY_KEY = ['admin-prospeccoes'] as const

export function useProspeccoes() {
  return useQuery({
    queryKey: PROSPECCOES_QUERY_KEY,
    staleTime: 45_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_prospeccoes_parceiro')
        .select('*')
        .is('arquivado_em', null)
        .order('updated_at', { ascending: false })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
      return (data ?? []) as ProspeccaoCard[]
    },
  })
}

export function useProspeccaoHistorico(prospeccaoId: string | null) {
  return useQuery({
    queryKey: [...PROSPECCOES_QUERY_KEY, 'historico', prospeccaoId],
    enabled: Boolean(prospeccaoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospeccoes_parceiro_historico')
        .select('id, status_anterior, status_novo, alterado_em, alterado_por')
        .eq('prospeccao_id', prospeccaoId!)
        .order('alterado_em', { ascending: false })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
      const rows = (data ?? []) as Omit<ProspeccaoHistoricoItem, 'autor_nome'>[]
      // resolve nomes dos autores em lote
      const ids = [...new Set(rows.map(r => r.alterado_por).filter(Boolean))] as string[]
      let nomes: Record<string, string> = {}
      if (ids.length > 0) {
        const { data: users } = await supabase.from('usuarios').select('id, nome_completo').in('id', ids)
        for (const u of (users ?? []) as { id: string; nome_completo: string }[]) nomes[u.id] = u.nome_completo
      }
      return rows.map(r => ({ ...r, autor_nome: r.alterado_por ? (nomes[r.alterado_por] ?? null) : null })) as ProspeccaoHistoricoItem[]
    },
  })
}

function useInvalidar(qc: ReturnType<typeof useQueryClient>) {
  return () => qc.invalidateQueries({ queryKey: PROSPECCOES_QUERY_KEY })
}

export function useProspeccaoCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      nome_empresa: string; contato_nome: string; contato_email?: string | null
      contato_telefone?: string | null; origem?: ProspeccaoOrigem; notas?: string | null
      proxima_acao_em?: string | null
    }) => {
      const { data, error } = await supabase.rpc('admin_prospeccao_create', {
        p_nome_empresa: input.nome_empresa,
        p_contato_nome: input.contato_nome,
        p_contato_email: input.contato_email ?? null,
        p_contato_telefone: input.contato_telefone ?? null,
        p_origem: input.origem ?? 'outro',
        p_notas: input.notas ?? null,
        p_responsavel_id: null,
        p_proxima_acao_em: input.proxima_acao_em ?? null,
      })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
      return data as string
    },
    onSuccess: useInvalidar(qc),
  })
}

export function useProspeccaoUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<{
      nome_empresa: string; contato_nome: string; contato_email: string; contato_telefone: string
      origem: ProspeccaoOrigem; notas: string; responsavel_id: string; proxima_acao_em: string
    }>) => {
      const { error } = await supabase.rpc('admin_prospeccao_update', {
        p_id: input.id,
        p_nome_empresa: input.nome_empresa ?? null,
        p_contato_nome: input.contato_nome ?? null,
        p_contato_email: input.contato_email ?? null,
        p_contato_telefone: input.contato_telefone ?? null,
        p_origem: input.origem ?? null,
        p_notas: input.notas ?? null,
        p_responsavel_id: input.responsavel_id ?? null,
        p_proxima_acao_em: input.proxima_acao_em ?? null,
      })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
    },
    onSuccess: useInvalidar(qc),
  })
}

export function useProspeccaoMove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; novoStatus: ProspeccaoStatus; statusEsperado: ProspeccaoStatus }) => {
      const { error } = await supabase.rpc('admin_prospeccao_move', {
        p_id: input.id,
        p_novo_status: input.novoStatus,
        p_status_esperado: input.statusEsperado,
      })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message), { cause: error })
    },
    onSettled: useInvalidar(qc),
  })
}

export function useProspeccaoArquivar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_prospeccao_arquivar', { p_id: input.id, p_motivo: input.motivo })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
    },
    onSuccess: useInvalidar(qc),
  })
}

export function useProspeccaoConverter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; partnerId: string; payload: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc('admin_prospeccao_converter', {
        p_prospeccao_id: input.id,
        p_partner_id: input.partnerId,
        p_payload: input.payload,
      })
      if (error) throw new Error(mapearErroProspeccao(error.code, error.message))
      return data as { proposta_id: string; protocolo: string | null }
    },
    onSuccess: useInvalidar(qc),
  })
}

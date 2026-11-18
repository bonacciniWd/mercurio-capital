import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { mapearErroProspeccaoCliente, type ProspeccaoCliente, type ProspeccaoClienteOrigem, type ProspeccaoClienteStatus } from '@/lib/prospeccaoCliente'

export const PROSPECCOES_CLIENTES_QUERY_KEY = ['prospeccoes-clientes'] as const

export function useProspeccoesClientes() {
  return useQuery({
    queryKey: PROSPECCOES_CLIENTES_QUERY_KEY,
    staleTime: 30_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ProspeccaoCliente[]> => {
      const { data, error } = await supabase
        .from('v_prospeccoes_clientes')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw new Error(mapearErroProspeccaoCliente(error.code, error.message))
      return (data ?? []) as ProspeccaoCliente[]
    },
  })
}

export function useProspeccaoCliente(id: string | null) {
  return useQuery({
    queryKey: [...PROSPECCOES_CLIENTES_QUERY_KEY, id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ProspeccaoCliente> => {
      const { data, error } = await supabase
        .from('v_prospeccoes_clientes')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw new Error(mapearErroProspeccaoCliente(error.code, error.message))
      return data as ProspeccaoCliente
    },
  })
}

function invalidateProspeccoes(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: PROSPECCOES_CLIENTES_QUERY_KEY })
}

export function useProspeccaoClienteCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      nome_completo: string
      email?: string | null
      telefone?: string | null
      equipe_id?: string | null
      origem?: ProspeccaoClienteOrigem | null
      notas?: string | null
      partner_id?: string
    }) => {
      const isAdmin = Boolean(input.partner_id)
      const { data, error } = isAdmin
        ? await supabase.rpc('admin_prospeccao_cliente_create', {
            p_partner_id: input.partner_id!,
            p_equipe_id: input.equipe_id ?? null,
            p_nome_completo: input.nome_completo,
            p_email: input.email ?? null,
            p_telefone: input.telefone ?? null,
            p_origem: input.origem ?? null,
            p_notas: input.notas ?? null,
          })
        : await supabase.rpc('partner_prospeccao_cliente_create', {
            p_nome_completo: input.nome_completo,
            p_email: input.email ?? null,
            p_telefone: input.telefone ?? null,
            p_equipe_id: input.equipe_id ?? null,
            p_origem: input.origem ?? null,
            p_notas: input.notas ?? null,
          })
      if (error) throw new Error(mapearErroProspeccaoCliente(error.code, error.message))
      return data as string
    },
    onSuccess: () => invalidateProspeccoes(qc),
  })
}

export function useProspeccaoClienteUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      nome_completo: string
      email?: string | null
      telefone?: string | null
      origem?: ProspeccaoClienteOrigem | null
      notas?: string | null
      equipe_id?: string | null
      limpar_equipe?: boolean
    }) => {
      const { error } = await supabase.rpc('prospeccao_cliente_update', {
        p_id: input.id,
        p_nome_completo: input.nome_completo,
        p_email: input.email ?? null,
        p_telefone: input.telefone ?? null,
        p_origem: input.origem ?? null,
        p_notas: input.notas ?? null,
        p_equipe_id: input.equipe_id ?? null,
        p_limpar_equipe: input.limpar_equipe ?? false,
      })
      if (error) throw new Error(mapearErroProspeccaoCliente(error.code, error.message))
    },
    onSuccess: () => invalidateProspeccoes(qc),
  })
}

export function useProspeccaoClienteMove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      novo_status: Exclude<ProspeccaoClienteStatus, 'proposta_criada'>
      status_esperado: Exclude<ProspeccaoClienteStatus, 'proposta_criada'>
      motivo_perda?: string | null
    }) => {
      const { error } = await supabase.rpc('prospeccao_cliente_move', {
        p_id: input.id,
        p_novo_status: input.novo_status,
        p_status_esperado: input.status_esperado,
        p_motivo_perda: input.motivo_perda ?? null,
      })
      if (error) throw new Error(mapearErroProspeccaoCliente(error.code, error.message))
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: PROSPECCOES_CLIENTES_QUERY_KEY, exact: true })
      const previous = qc.getQueryData<ProspeccaoCliente[]>(PROSPECCOES_CLIENTES_QUERY_KEY)
      qc.setQueryData<ProspeccaoCliente[]>(PROSPECCOES_CLIENTES_QUERY_KEY, current => current?.map(row => row.id === input.id
        ? { ...row, status: input.novo_status, motivo_perda: input.novo_status === 'perdido' ? input.motivo_perda ?? null : null } : row))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(PROSPECCOES_CLIENTES_QUERY_KEY, context.previous)
    },
    onSettled: () => invalidateProspeccoes(qc),
  })
}

export type ProspeccaoClienteConversionResult = {
  proposta_id: string
  protocolo?: string | null
  cliente_id?: string | null
  magic_token?: string | null
  partner_id?: string | null
  equipe_id?: string | null
}

export function useProspeccaoClienteConvert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; payload: Record<string, unknown>; admin: boolean }) => {
      const { data, error } = input.admin
        ? await supabase.rpc('admin_prospeccao_cliente_converter', { p_id: input.id, p_payload: input.payload })
        : await supabase.rpc('partner_prospeccao_cliente_converter', { p_id: input.id, p_payload: input.payload })
      if (error) throw new Error(mapearErroProspeccaoCliente(error.code, error.message))
      return data as ProspeccaoClienteConversionResult
    },
    onSuccess: () => {
      invalidateProspeccoes(qc)
      void qc.invalidateQueries({ queryKey: ['partner-propostas'] })
      void qc.invalidateQueries({ queryKey: ['admin-propostas'] })
    },
  })
}

export type ProspeccaoClienteHistorico = { id: string; status_anterior: string | null; status_novo: string; alterado_em: string; motivo: string | null }
export function useProspeccaoClienteHistorico(id: string | null) {
  return useQuery({
    queryKey: [...PROSPECCOES_CLIENTES_QUERY_KEY, 'historico', id], enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('prospeccoes_clientes_historico')
        .select('id, status_anterior, status_novo, alterado_em, motivo').eq('prospeccao_id', id!).order('alterado_em', { ascending: false })
      if (error) throw new Error(mapearErroProspeccaoCliente(error.code, error.message))
      return (data ?? []) as ProspeccaoClienteHistorico[]
    },
  })
}

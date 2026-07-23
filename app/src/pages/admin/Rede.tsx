import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Network as NetworkIcon, RefreshCw, Building2, Users, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RedeFlowCanvas, type RedeGraph } from '@/components/rede/RedeFlow'

export function AdminRede() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>('approved')
  const [limit, setLimit] = useState(20)

  const graphQuery = useQuery({
    queryKey: ['admin-rede', status, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_rede_graph', {
        p_status: status || null,
        p_limit: limit,
      })
      if (error) throw error
      return data as RedeGraph
    },
  })

  const refreshMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_refresh_mvs')
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rede'] }),
  })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Rede de originação</h1>
          <p className="text-sm text-silver-500">Mapa interativo (React Flow) de parceiros → equipes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input h-9" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="approved">Aprovados</option>
            <option value="pending">Pendentes</option>
            <option value="suspended">Suspensos</option>
            <option value="">Todos</option>
          </select>
          <select className="input h-9 w-24" value={limit} onChange={e => setLimit(Number(e.target.value))}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="btn-outline h-9" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
            {refreshMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh MVs
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-silver-100 px-4 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5"><Crown className="h-3 w-3 text-red-600" /> Admin</span>
          <span className="inline-flex items-center gap-1.5"><Building2 className="h-3 w-3 text-success" /> Parceiro</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3 text-red-600-700" /> Equipe</span>
          {graphQuery.data && (
            <span className="ml-auto text-silver-500">
              {graphQuery.data.nodes.length} nós · {graphQuery.data.edges.length} conexões
            </span>
          )}
        </div>
        <div className="h-[600px] bg-silver-50">
          {graphQuery.isLoading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-silver-500" /></div>
          ) : graphQuery.error ? (
            <div className="flex h-full items-center justify-center text-red-600">
              <NetworkIcon className="mr-2 h-5 w-5" /> Erro: {(graphQuery.error as Error).message}
            </div>
          ) : (
            <RedeFlowCanvas graph={graphQuery.data ?? { nodes: [], edges: [] }} />
          )}
        </div>
      </div>
    </>
  )
}

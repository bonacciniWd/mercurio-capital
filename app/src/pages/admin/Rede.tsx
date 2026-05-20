import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2, Network as NetworkIcon, RefreshCw, Building2, Users, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type RedeNode = {
  id: string
  tipo: 'admin' | 'partner' | 'equipe'
  label: string
  status?: string
  propostas?: number
  membros?: number
}
type RedeEdge = { id: string; source: string; target: string }
type RedeGraph = { nodes: RedeNode[]; edges: RedeEdge[] }

function AdminNode({ data }: NodeProps) {
  const d = data as { label: string }
  return (
    <div className="rounded-xl border-2 border-gold bg-navy px-5 py-3 text-center text-white shadow-lg">
      <Crown className="mx-auto h-5 w-5 text-gold" />
      <div className="mt-1 text-xs font-bold uppercase tracking-wider text-gold">Mercúrio</div>
      <div className="text-sm font-semibold">{d.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gold" />
    </div>
  )
}

function PartnerNode({ data }: NodeProps) {
  const d = data as { label: string; status: string; propostas: number }
  const accent = d.status === 'approved' ? 'border-success' : d.status === 'pending' ? 'border-amber-400' : 'border-silver-300'
  return (
    <div className={`rounded-lg border-2 ${accent} bg-white px-3 py-2 shadow min-w-[160px]`}>
      <Handle type="target" position={Position.Top} className="!bg-success" />
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-success" />
        <span className="text-[10px] uppercase text-silver-500">Parceiro</span>
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-navy">{d.label}</div>
      <div className="mt-0.5 text-[11px] text-silver-600">{d.propostas} propostas</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gold" />
    </div>
  )
}

function EquipeNode({ data }: NodeProps) {
  const d = data as { label: string; membros: number }
  return (
    <div className="rounded-md border-2 border-gold/70 bg-gold/10 px-2.5 py-1.5 shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-gold" />
      <div className="flex items-center gap-1">
        <Users className="h-3 w-3 text-gold-700" />
        <span className="text-[10px] uppercase text-gold-700">Equipe</span>
      </div>
      <div className="mt-0.5 max-w-[140px] truncate text-xs font-semibold text-navy">{d.label}</div>
      <div className="text-[10px] text-silver-600">{d.membros} membros</div>
    </div>
  )
}

const NODE_TYPES = { admin: AdminNode, partner: PartnerNode, equipe: EquipeNode }

function layoutGraph(g: RedeGraph): { nodes: Node[]; edges: Edge[] } {
  const partners = g.nodes.filter(n => n.tipo === 'partner')
  const equipes = g.nodes.filter(n => n.tipo === 'equipe')

  const partnerX = (i: number) => i * 220 + 40
  const partnerYBase = 200
  const adminX = ((partners.length - 1) * 220) / 2 + 40

  const partnerIndex = new Map<string, number>()
  partners.forEach((p, i) => partnerIndex.set(p.id, i))

  const equipesByPartner = new Map<string, RedeNode[]>()
  for (const e of equipes) {
    const edge = g.edges.find(ed => ed.target === e.id)
    if (!edge) continue
    const arr = equipesByPartner.get(edge.source) ?? []
    arr.push(e)
    equipesByPartner.set(edge.source, arr)
  }

  const nodes: Node[] = []

  nodes.push({
    id: 'admin', type: 'admin',
    position: { x: adminX, y: 0 },
    data: { label: g.nodes.find(n => n.tipo === 'admin')?.label ?? 'Admin' },
  })

  partners.forEach((p, i) => {
    nodes.push({
      id: p.id, type: 'partner',
      position: { x: partnerX(i), y: partnerYBase },
      data: { label: p.label, status: p.status, propostas: p.propostas ?? 0 },
    })
    const eqs = equipesByPartner.get(p.id) ?? []
    eqs.forEach((eq, ej) => {
      nodes.push({
        id: eq.id, type: 'equipe',
        position: { x: partnerX(i) - 20 + (ej % 2) * 80, y: partnerYBase + 140 + Math.floor(ej / 2) * 70 },
        data: { label: eq.label, membros: eq.membros ?? 0 },
      })
    })
  })

  const edges: Edge[] = g.edges.map(e => ({
    id: e.id, source: e.source, target: e.target, animated: false,
    style: { stroke: '#9CA3AF', strokeWidth: 1.4 },
  }))

  return { nodes, edges }
}

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

  const layout = useMemo(
    () => graphQuery.data ? layoutGraph(graphQuery.data) : { nodes: [], edges: [] },
    [graphQuery.data],
  )

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
          <span className="inline-flex items-center gap-1.5"><Crown className="h-3 w-3 text-gold" /> Admin</span>
          <span className="inline-flex items-center gap-1.5"><Building2 className="h-3 w-3 text-success" /> Parceiro</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3 text-gold-700" /> Equipe</span>
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
            <ReactFlow
              nodes={layout.nodes}
              edges={layout.edges}
              nodeTypes={NODE_TYPES}
              fitView
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              nodesConnectable={false}
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          )}
        </div>
      </div>
    </>
  )
}

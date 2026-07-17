import { useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Building2, Crown, Users } from 'lucide-react'

export type RedeNode = {
  id: string
  tipo: 'admin' | 'partner' | 'equipe'
  label: string
  status?: string
  propostas?: number
  membros?: number
}

export type RedeEdge = {
  id: string
  source: string
  target: string
}

export type RedeGraph = {
  nodes: RedeNode[]
  edges: RedeEdge[]
}

function AdminNode({ data }: NodeProps) {
  const d = data as { label: string }
  return (
    <div className="rounded-xl border-2 border-gold bg-navy px-5 py-3 text-center text-white shadow-lg">
      <Crown className="mx-auto h-5 w-5 text-gold" />
      <div className="mt-1 text-xs font-bold uppercase tracking-wider text-gold">Mercurio</div>
      <div className="text-sm font-semibold">{d.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gold" />
    </div>
  )
}

function PartnerNode({ data }: NodeProps) {
  const d = data as { label: string; status: string; propostas: number }
  const accent = d.status === 'approved'
    ? 'border-success'
    : d.status === 'pending'
      ? 'border-amber-400'
      : 'border-silver-300'

  return (
    <div className={`min-w-[160px] rounded-lg border-2 ${accent} bg-white px-3 py-2 shadow`}>
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

export function layoutRedeGraph(graph: RedeGraph): { nodes: Node[]; edges: Edge[] } {
  const adminNode = graph.nodes.find((node) => node.tipo === 'admin')
  const partners = graph.nodes.filter((node) => node.tipo === 'partner')
  const equipes = graph.nodes.filter((node) => node.tipo === 'equipe')

  const partnerX = (index: number) => index * 220 + 40
  const partnerY = adminNode ? 200 : 80
  const adminX = partners.length > 0 ? ((partners.length - 1) * 220) / 2 + 40 : 40

  const partnerIndex = new Map<string, number>()
  partners.forEach((partner, index) => partnerIndex.set(partner.id, index))

  const equipesByPartner = new Map<string, RedeNode[]>()
  for (const equipe of equipes) {
    const parentEdge = graph.edges.find(
      (edge) => edge.target === equipe.id && partnerIndex.has(edge.source),
    )
    if (!parentEdge) continue

    const current = equipesByPartner.get(parentEdge.source) ?? []
    current.push(equipe)
    equipesByPartner.set(parentEdge.source, current)
  }

  const nodes: Node[] = []

  if (adminNode) {
    nodes.push({
      id: adminNode.id,
      type: 'admin',
      position: { x: adminX, y: 0 },
      data: { label: adminNode.label },
    })
  }

  partners.forEach((partner, partnerIdx) => {
    nodes.push({
      id: partner.id,
      type: 'partner',
      position: { x: partnerX(partnerIdx), y: partnerY },
      data: {
        label: partner.label,
        status: partner.status ?? 'pending',
        propostas: partner.propostas ?? 0,
      },
    })

    const equipesPartner = equipesByPartner.get(partner.id) ?? []
    equipesPartner.sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

    equipesPartner.forEach((equipe, equipeIdx) => {
      nodes.push({
        id: equipe.id,
        type: 'equipe',
        position: {
          x: partnerX(partnerIdx) - 20 + (equipeIdx % 2) * 80,
          y: partnerY + 140 + Math.floor(equipeIdx / 2) * 70,
        },
        data: { label: equipe.label, membros: equipe.membros ?? 0 },
      })
    })
  })

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: false,
    style: { stroke: '#9CA3AF', strokeWidth: 1.4 },
  }))

  return { nodes, edges }
}

export function RedeFlowCanvas({ graph, height = 600 }: { graph: RedeGraph; height?: number }) {
  const layout = useMemo(() => layoutRedeGraph(graph), [graph])

  if (layout.nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-silver-50 text-sm text-silver-500"
        style={{ height }}
      >
        Nenhum dado para desenhar o mapa.
      </div>
    )
  }

  return (
    <div className="bg-silver-50" style={{ height }}>
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
    </div>
  )
}

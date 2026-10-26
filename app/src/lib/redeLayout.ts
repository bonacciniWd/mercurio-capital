import type { Edge } from '@xyflow/react'
import type { RedeGraph } from '@/components/rede/RedeFlow'
import type { NetworkCardNode } from '@/components/rede/NetworkCanvas'

export function layoutAdminRedeGraph(graph: RedeGraph): { nodes: NetworkCardNode[]; edges: Edge[] } {
  const partners = graph.nodes.filter(node => node.tipo === 'partner')
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(partners.length))))
  const positions = new Map<string, { x: number; y: number }>()
  const root = graph.nodes.find(node => node.tipo === 'admin')
  if (root) positions.set(root.id, { x: (columns - 1) * 284 / 2, y: 0 })
  let rowY = root ? 220 : 0
  for (let index = 0; index < partners.length; index += columns) {
    let rowHeight = 210
    partners.slice(index, index + columns).forEach((partner, column) => {
      positions.set(partner.id, { x: column * 284, y: rowY })
      const teams = graph.nodes.filter(node => node.tipo === 'equipe' && graph.edges.some(edge => edge.source === partner.id && edge.target === node.id))
      teams.forEach((team, teamIndex) => positions.set(team.id, { x: column * 284, y: rowY + 175 + teamIndex * 165 }))
      rowHeight = Math.max(rowHeight, 210 + teams.length * 165)
    })
    rowY += rowHeight + 65
  }
  const nodes: NetworkCardNode[] = graph.nodes.filter(node => positions.has(node.id)).map(node => ({
    id: node.id, type: 'networkCard', position: positions.get(node.id)!,
    data: {
      kind: node.tipo, label: node.label,
      subtitle: node.tipo === 'partner' ? `${node.propostas ?? 0} propostas originadas` : node.tipo === 'equipe' ? `${node.membros ?? 0} membros` : 'Rede de originação',
      detail: node.tipo === 'partner' ? ({ approved: 'Aprovado', pending: 'Pendente', rejected: 'Recusado', suspended: 'Suspenso' }[node.status ?? 'pending'] ?? 'Sem status') : node.tipo === 'equipe' ? 'Equipe do parceiro' : `${partners.length} parceiros no mapa`,
    },
  }))
  return { nodes, edges: graph.edges.filter(edge => positions.has(edge.source) && positions.has(edge.target)).map(edge => ({ ...edge, type: 'smoothstep', style: { stroke: '#c6c8d0', strokeWidth: 1.3 } })) }
}

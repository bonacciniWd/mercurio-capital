import { describe, expect, it } from 'vitest'
import { layoutAdminRedeGraph } from './redeLayout'
import type { RedeGraph } from '@/components/rede/RedeFlow'

describe('layout da rede administrativa', () => {
  it('distribui parceiros em vários ramos e reserva espaço para suas equipes', () => {
    const graph: RedeGraph = {
      nodes: [{ id: 'admin', tipo: 'admin', label: 'Mercúrio' }, ...Array.from({ length: 20 }, (_, index) => ({ id: `p-${index}`, tipo: 'partner' as const, label: `Parceiro ${index}` })), ...Array.from({ length: 4 }, (_, index) => ({ id: `t-${index}`, tipo: 'equipe' as const, label: `Equipe ${index}` }))],
      edges: [...Array.from({ length: 20 }, (_, index) => ({ id: `e-${index}`, source: 'admin', target: `p-${index}` })), ...Array.from({ length: 4 }, (_, index) => ({ id: `et-${index}`, source: 'p-0', target: `t-${index}` }))],
    }
    const layout = layoutAdminRedeGraph(graph)
    expect(layout.nodes).toHaveLength(25)
    expect(new Set(layout.nodes.filter(node => node.data.kind === 'partner').map(node => node.position.y)).size).toBeGreaterThan(1)
    for (let i = 0; i < layout.nodes.length; i++) for (let j = i + 1; j < layout.nodes.length; j++) {
      const a = layout.nodes[i].position, b = layout.nodes[j].position
      expect(Math.abs(a.x - b.x) >= 242 || Math.abs(a.y - b.y) >= 142).toBe(true)
    }
  })

  it('não desenha conexões com nós que não vieram na seleção', () => {
    const result = layoutAdminRedeGraph({ nodes: [{ id: 'admin', tipo: 'admin', label: 'Admin' }], edges: [{ id: 'orphan', source: 'missing', target: 'admin' }] })
    expect(result.edges).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { reconcileNetworkNodes } from './networkNodes'

describe('atualização de cards do mapa', () => {
  const measured: Node<{ label: string }> = { id: 'person', position: { x: 500, y: 300 }, measured: { width: 242, height: 142 }, data: { label: 'Nome anterior' } }
  const updated: Node<{ label: string }> = { id: 'person', position: { x: 10, y: 20 }, selected: true, data: { label: 'Nome atualizado' } }

  it('atualiza os dados e a seleção sem apagar medidas nem posição arrastada', () => {
    const [node] = reconcileNetworkNodes([measured], [updated])
    expect(node.measured).toEqual({ width: 242, height: 142 })
    expect(node.position).toEqual({ x: 500, y: 300 })
    expect(node.data.label).toBe('Nome atualizado')
    expect(node.selected).toBe(true)
  })

  it('reorganiza as posições preservando medidas e remove nós que saíram do mapa', () => {
    const result = reconcileNetworkNodes([measured, { ...measured, id: 'removed' }], [updated], false)
    expect(result).toHaveLength(1)
    expect(result[0].position).toEqual({ x: 10, y: 20 })
    expect(result[0].measured).toEqual(measured.measured)
  })
})

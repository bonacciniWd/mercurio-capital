import type { Node } from '@xyflow/react'

/** Retain React Flow's measured dimensions when refreshing data or selection. */
export function reconcileNetworkNodes<N extends Node>(current: N[], next: N[], keepPositions = true): N[] {
  const existing = new Map(current.map(node => [node.id, node]))
  return next.map(node => {
    const previous = existing.get(node.id)
    return {
      ...previous, ...node,
      position: keepPositions ? previous?.position ?? node.position : node.position,
      measured: previous?.measured ?? node.measured,
    }
  })
}

export type InternalOrgPerson = {
  usuario_id: string
  gestor_usuario_id: string | null
}

export type InternalOrgNode<T extends InternalOrgPerson> = T & { children: InternalOrgNode<T>[] }

/** Builds a finite tree, promoting orphaned/cyclic nodes to roots defensively. */
export function buildInternalOrgTree<T extends InternalOrgPerson>(people: T[]): InternalOrgNode<T>[] {
  const byId = new Map(people.map(person => [person.usuario_id, { ...person, children: [] as InternalOrgNode<T>[] }]))
  const roots: InternalOrgNode<T>[] = []
  for (const node of byId.values()) {
    if (!node.gestor_usuario_id || !byId.has(node.gestor_usuario_id) || node.gestor_usuario_id === node.usuario_id) {
      roots.push(node)
      continue
    }
    byId.get(node.gestor_usuario_id)!.children.push(node)
  }

  const visited = new Set<string>()
  const normalize = (node: InternalOrgNode<T>) => {
    if (visited.has(node.usuario_id)) return
    visited.add(node.usuario_id)
    node.children = node.children.filter(child => !visited.has(child.usuario_id))
    node.children.forEach(normalize)
  }
  roots.forEach(normalize)
  for (const node of byId.values()) {
    if (!visited.has(node.usuario_id)) {
      node.gestor_usuario_id = null
      roots.push(node)
      normalize(node)
    }
  }
  return roots
}

export type InternalEmployee = InternalOrgPerson & {
  nome_completo: string
  cargo: string | null
  departamento: string | null
  foto_path: string | null
  data_inicio: string | null
  cargo_id?: string | null
  departamento_id?: string | null
  ativo?: boolean
}

export type InternalProfileDraft = { cargo: string; departamento: string; gestor: string; dataInicio: string }

export function profileDraft(person: InternalEmployee): InternalProfileDraft {
  return { cargo: person.cargo_id ?? '', departamento: person.departamento_id ?? '', gestor: person.gestor_usuario_id ?? '', dataInicio: person.data_inicio ?? '' }
}

export function internalDescendants(people: InternalOrgPerson[], id: string): Set<string> {
  const found = new Set<string>([id])
  const pending = [id]
  while (pending.length) {
    const parent = pending.pop()
    for (const person of people) {
      if (person.gestor_usuario_id === parent && !found.has(person.usuario_id)) {
        found.add(person.usuario_id)
        pending.push(person.usuario_id)
      }
    }
  }
  found.delete(id)
  return found
}

export function canAssignInternalManager(people: InternalEmployee[], personId: string, managerId: string | null): boolean {
  if (!managerId) return true
  return managerId !== personId
    && people.some(person => person.usuario_id === managerId && person.ativo !== false)
    && !internalDescendants(people, personId).has(managerId)
}

/** Apply only edited fields to the latest profile; retain photo and concurrently changed untouched fields. */
export function internalProfilePayload(baseline: InternalEmployee, draft: InternalProfileDraft, latest: InternalEmployee) {
  const original = profileDraft(baseline)
  const current = profileDraft(latest)
  return {
    p_usuario_id: latest.usuario_id,
    p_cargo_id: (draft.cargo !== original.cargo ? draft.cargo : current.cargo) || null,
    p_departamento_id: (draft.departamento !== original.departamento ? draft.departamento : current.departamento) || null,
    p_gestor_usuario_id: (draft.gestor !== original.gestor ? draft.gestor : current.gestor) || null,
    p_foto_path: latest.foto_path,
    p_data_inicio: (draft.dataInicio !== original.dataInicio ? draft.dataInicio : current.dataInicio) || null,
  }
}

export function layoutInternalOrg(people: InternalOrgPerson[]) {
  const tree = buildInternalOrgTree(people)
  const positions: Array<{ id: string; x: number; y: number }> = []
  const connections: Array<{ id: string; source: string; target: string }> = []
  const widths = new Map<string, number>()
  const measure = (node: InternalOrgNode<InternalOrgPerson>): number => {
    const width = Math.max(284, node.children.reduce((total, child) => total + measure(child), 0))
    widths.set(node.usuario_id, width)
    return width
  }
  tree.forEach(measure)
  const shelfWidth = Math.max(852, ...widths.values())
  const place = (node: InternalOrgNode<InternalOrgPerson>, x: number, y: number): number => {
    positions.push({ id: node.usuario_id, x: x + widths.get(node.usuario_id)! / 2 - 121, y })
    let left = x
    let bottom = y + 210
    for (const child of node.children) {
      connections.push({ id: `${node.usuario_id}-${child.usuario_id}`, source: node.usuario_id, target: child.usuario_id })
      bottom = Math.max(bottom, place(child, left, y + 210))
      left += widths.get(child.usuario_id)!
    }
    return bottom
  }
  let x = 0, y = 0, rowBottom = 0
  for (const root of tree) {
    const width = widths.get(root.usuario_id)!
    if (x > 0 && x + width > shelfWidth) { x = 0; y = rowBottom + 45 }
    rowBottom = Math.max(rowBottom, place(root, x, y))
    x += width
  }
  return { positions, connections }
}

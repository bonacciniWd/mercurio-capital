import { describe, expect, it } from 'vitest'
import { buildInternalOrgTree, canAssignInternalManager, internalProfilePayload, layoutInternalOrg, profileDraft, type InternalEmployee } from './internalOrg'

const people = [
  { usuario_id: 'ceo', gestor_usuario_id: null, nome: 'CEO' },
  { usuario_id: 'cfo', gestor_usuario_id: 'ceo', nome: 'CFO' },
  { usuario_id: 'ops', gestor_usuario_id: 'cfo', nome: 'Operações' },
  { usuario_id: 'orphan', gestor_usuario_id: 'removed', nome: 'Sem gestor ativo' },
]

describe('buildInternalOrgTree', () => {
  it('groups direct reports recursively and promotes employees with missing managers to root', () => {
    const tree = buildInternalOrgTree(people)
    expect(tree.map(person => person.usuario_id)).toEqual(['ceo', 'orphan'])
    expect(tree[0].children[0].usuario_id).toBe('cfo')
    expect(tree[0].children[0].children[0].usuario_id).toBe('ops')
    expect(tree[1].gestor_usuario_id).toBe('removed')
  })

  it('breaks unexpected cycles so corrupt data cannot lock the page', () => {
    const tree = buildInternalOrgTree([
      { usuario_id: 'a', gestor_usuario_id: 'b' },
      { usuario_id: 'b', gestor_usuario_id: 'a' },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].children).toHaveLength(0)
  })
})

const employee = (id: string, manager: string | null = null): InternalEmployee => ({ usuario_id: id, gestor_usuario_id: manager, nome_completo: id, cargo: null, departamento: null, foto_path: null, data_inicio: null, ativo: true })

describe('edição do organograma', () => {
  it('rejeita auto-gestão, descendentes e gestor inativo, mantendo remoção do gestor válida', () => {
    const entries = [employee('a'), employee('b', 'a'), employee('c', 'b'), { ...employee('off'), ativo: false }]
    expect(canAssignInternalManager(entries, 'a', 'a')).toBe(false)
    expect(canAssignInternalManager(entries, 'a', 'c')).toBe(false)
    expect(canAssignInternalManager(entries, 'b', 'off')).toBe(false)
    expect(canAssignInternalManager(entries, 'c', 'a')).toBe(true)
    expect(canAssignInternalManager(entries, 'b', null)).toBe(true)
  })

  it('preserva foto e campos concorrentes não editados no payload', () => {
    const original = { ...employee('a'), foto_path: 'a/old.jpg', cargo_id: 'old-cargo', departamento_id: 'old-department', data_inicio: '2026-01-01' }
    const latest = { ...original, foto_path: 'a/new.jpg', departamento_id: 'new-department', data_inicio: '2026-02-01' }
    const payload = internalProfilePayload(original, { ...profileDraft(original), gestor: 'boss' }, latest)
    expect(payload).toEqual({ p_usuario_id: 'a', p_gestor_usuario_id: 'boss', p_cargo_id: 'old-cargo', p_departamento_id: 'new-department', p_foto_path: 'a/new.jpg', p_data_inicio: '2026-02-01' })
  })

  it('acomoda árvores de diferentes tamanhos sem sobrepor cards e ignora conexões órfãs', () => {
    const entries = [employee('a'), ...Array.from({ length: 6 }, (_, i) => employee(`a-${i}`, 'a')), employee('deep', 'a-1'), employee('orphan', 'missing'), ...Array.from({ length: 8 }, (_, i) => employee(`root-${i}`))]
    const { positions, connections } = layoutInternalOrg(entries)
    expect(new Set(positions.map(node => node.id)).size).toBe(entries.length)
    expect(connections.some(edge => edge.source === 'missing')).toBe(false)
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i], b = positions[j]
      expect(Math.abs(a.x - b.x) >= 242 || Math.abs(a.y - b.y) >= 142).toBe(true)
    }
    const parent = positions.find(node => node.id === 'a')!
    expect(positions.find(node => node.id === 'deep')!.y).toBeGreaterThan(parent.y + 210)
  })
})

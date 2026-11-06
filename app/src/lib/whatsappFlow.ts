// Keep aligned with `supabase/functions/_shared/whatsapp-flow.ts`.
// This browser-local copy is required because Vercel builds from `app/` only.
export type Kind = 'entry' | 'condition' | 'recipients' | 'template' | 'reply' | 'menu' | 'form' | 'handoff' | 'end'
export type FlowNode = { id: string; type?: string; position: { x: number; y: number }; data: Record<string, unknown> & { kind: Kind; label: string } }
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null }
export type Graph = { nodes: FlowNode[]; edges: FlowEdge[]; viewport: { x: number; y: number; zoom: number } }
export const KINDS: Kind[] = ['entry', 'condition', 'recipients', 'template', 'reply', 'menu', 'form', 'handoff', 'end']
export const EVENTS = ['conta_criada', 'partner_aprovado', 'proposta_criada', 'proposta_status_changed', 'pendencia_aberta', 'contrato_disponivel', 'recurso_liberado', 'mensagem_recebida']
export const ROLES = ['principal', 'originador', 'responsavel', 'signatario', 'titular']
const FIELDS = ['evento', 'status', 'produto']
export function validateGraph(graph: Graph, mode: string): string[] {
  const errors: string[] = []
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !graph.viewport) return ['Formato de grafo inválido.']
  if (graph.nodes.length < 2 || graph.nodes.length > 60 || graph.edges.length > 100 || JSON.stringify(graph).length > 100000) return ['Use de 2 a 60 nós e no máximo 100 conexões.']
  const ids = new Set<string>(); const entries = graph.nodes.filter(n => n.data?.kind === 'entry')
  for (const n of graph.nodes) {
    if (!n.id || ids.has(n.id) || !/^[\w-]{1,80}$/.test(n.id)) errors.push('Identificador de nó inválido ou repetido.')
    ids.add(n.id)
    if (!n.data || !KINDS.includes(n.data.kind) || typeof n.data.label !== 'string' || n.data.label.length > 100) { errors.push(`${n.id}: tipo ou título inválido.`); continue }
    if (!Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y)) errors.push(`${n.id}: posição inválida.`)
    if (n.data.kind === 'entry' && (!EVENTS.includes(String(n.data.event)) || (mode === 'atendimento' ? n.data.event !== 'mensagem_recebida' : n.data.event === 'mensagem_recebida'))) errors.push(`${n.id}: escolha um evento permitido.`)
    if (n.data.kind === 'condition' && (!FIELDS.includes(String(n.data.field)) || !['=', '!=', 'in'].includes(String(n.data.op)) || typeof n.data.value !== 'string')) errors.push(`${n.id}: condição inválida.`)
    if (n.data.kind === 'recipients' && (!Array.isArray(n.data.roles) || !n.data.roles.length || n.data.roles.some(r => !ROLES.includes(String(r))))) errors.push(`${n.id}: escolha destinatários permitidos.`)
    if (n.data.kind === 'template' && !/^[a-z][a-z0-9_]{1,90}$/.test(String(n.data.template ?? ''))) errors.push(`${n.id}: selecione um template.`)
    if (['reply', 'menu', 'form'].includes(n.data.kind) && (typeof n.data.text !== 'string' || !n.data.text.trim() || n.data.text.length > 2000)) errors.push(`${n.id}: escreva uma mensagem de até 2.000 caracteres.`)
    if (n.data.kind === 'menu') {
      const opts = n.data.options as { id: string; title: string }[] | undefined
      if (!Array.isArray(opts) || !opts.length || opts.length > 8 || new Set(opts.map(o => o.id)).size !== opts.length || opts.some(o => !/^[\w-]{1,40}$/.test(o.id) || !o.title?.trim() || o.title.length > 24)) errors.push(`${n.id}: opções de menu inválidas.`)
    }
    if (mode === 'notificacao' && ['reply', 'menu', 'form', 'handoff'].includes(n.data.kind)) errors.push(`${n.id}: nó exclusivo de atendimento.`)
    if (mode === 'atendimento' && ['recipients', 'template'].includes(n.data.kind)) errors.push(`${n.id}: nó exclusivo de notificação.`)
  }
  if (entries.length !== 1) errors.push('O fluxo precisa de uma única entrada.')
  const edgeIds = new Set<string>()
  for (const e of graph.edges) {
    if (edgeIds.has(e.id) || !ids.has(e.source) || !ids.has(e.target) || e.source === e.target) errors.push('Conexão inválida ou repetida.')
    edgeIds.add(e.id)
  }
  const seen = new Set<string>(); const stack = new Set<string>()
  function visit(id: string) {
    if (stack.has(id)) { errors.push('Conexões não podem formar ciclos.'); return }
    if (seen.has(id)) return
    seen.add(id); stack.add(id)
    graph.edges.filter(e => e.source === id).forEach(e => visit(e.target)); stack.delete(id)
  }
  if (entries[0]) visit(entries[0].id)
  if (seen.size !== graph.nodes.length) errors.push('Todos os nós devem estar ligados à entrada.')
  for (const n of graph.nodes) {
    const out = graph.edges.filter(e => e.source === n.id)
    const expected = n.data.kind === 'condition' ? ['yes', 'no'] : n.data.kind === 'menu' ? ((n.data.options as { id: string }[] | undefined) ?? []).map(o => o.id) : ['next']
    if (['end', 'handoff'].includes(n.data.kind)) { if (out.length) errors.push(`${n.id}: nó final não pode ter saída.`); continue }
    if (out.length !== expected.length || expected.some(h => out.filter(e => (e.sourceHandle || 'next') === h).length !== 1)) errors.push(`${n.id}: conecte cada saída uma única vez.`)
  }
  if (!['notificacao', 'atendimento'].includes(mode)) errors.push('Modo inválido.')
  return [...new Set(errors)]
}
export function nextNode(graph: Graph, id: string, handle = 'next'): string | undefined {
  return graph.edges.find(e => e.source === id && (e.sourceHandle || 'next') === handle)?.target
}
export function condition(data: FlowNode['data'], context: Record<string, string>): boolean {
  const actual = context[String(data.field)] ?? ''; const value = String(data.value ?? '')
  return data.op === '=' ? actual === value : data.op === '!=' ? actual !== value : data.op === 'in' && value.split(',').map(s => s.trim()).includes(actual)
}
export function traceGraph(graph: Graph, mode: string, context: Record<string, string> = {}, start?: string): FlowNode[] {
  const errors = validateGraph(graph, mode); if (errors.length) throw new Error(errors.join('\n'))
  let current = start ?? graph.nodes.find(n => n.data.kind === 'entry')!.id; const result: FlowNode[] = []
  for (let steps = 0; current && steps < 60; steps++) {
    const n = graph.nodes.find(n => n.id === current); if (!n) throw new Error('Nó não encontrado.')
    result.push(n)
    if (['menu', 'form', 'handoff', 'end'].includes(n.data.kind)) break
    current = nextNode(graph, current, n.data.kind === 'condition' ? (condition(n.data, context) ? 'yes' : 'no') : 'next') ?? ''
  }
  return result
}
export function compileNativeFlow(graph: Graph): Record<string, unknown> {
  const errors = validateGraph(graph, 'atendimento'); if (errors.length) throw new Error(errors.join('\n'))
  const unsupported = graph.nodes.filter(n => !['entry', 'menu', 'form', 'end'].includes(n.data.kind))
  if (unsupported.length) throw new Error(unsupported.map(n => `${n.id}: ${n.data.kind} não pode ser exportado como formulário Meta.`).join('\n'))
  // A static linear form is the supported subset. Conversational branches stay server-side.
  const menuNodes = graph.nodes.filter(n => n.data.kind === 'menu')
  if (menuNodes.length) throw new Error(`${menuNodes[0].id}: use um nó Formulário para o menu nativo; ramificações conversacionais não são exportáveis.`)
  const forms: FlowNode[] = []
  let cursor = nextNode(graph, graph.nodes.find(n => n.data.kind === 'entry')!.id)
  while (cursor) { const node = graph.nodes.find(n => n.id === cursor)!; if (node.data.kind === 'form') forms.push(node); if (node.data.kind === 'end') break; cursor = nextNode(graph, node.id) }
  if (!forms.length) throw new Error('Inclua pelo menos um formulário.')
  const screenId = (id: string) => `SCREEN_${forms.findIndex(n => n.id === id)}`
  const screens = forms.map(n => {
    const target = graph.nodes.find(o => o.id === nextNode(graph, n.id)); const terminal = target?.data.kind === 'end'
    if (!target || (!terminal && target.data.kind !== 'form')) throw new Error(`${n.id}: destino nativo incompatível.`)
    return { id: screenId(n.id), title: n.data.label, ...(terminal ? { terminal: true, success: true } : {}), data: {}, layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: 'triagem', children: [
      { type: 'TextBody', text: n.data.text },
      { type: 'TextInput', name: 'nome', label: 'Como podemos chamar você?', required: false, 'input-type': 'text', 'max-chars': '80' },
      { type: 'Dropdown', name: 'assunto', label: 'Como podemos ajudar?', required: true, 'data-source': [{ id: 'cliente', title: 'Já sou cliente ou parceiro' }, { id: 'credito', title: 'Opções de crédito' }, { id: 'parceiro', title: 'Quero ser parceiro' }, { id: 'humano', title: 'Falar com a equipe' }] },
      { type: 'Footer', label: terminal ? 'Concluir' : 'Continuar', 'on-click-action': terminal ? { name: 'complete', payload: { nome: '${form.nome}', assunto: '${form.assunto}' } } : { name: 'navigate', next: { type: 'screen', name: screenId(target.id) }, payload: {} } },
    ] }] } }
  })
  return { version: '7.3', screens }
}
export function initialGraph(mode: 'notificacao' | 'atendimento'): Graph {
  const nodes: FlowNode[] = [{ id: 'entry', type: 'wa', position: { x: 60, y: 40 }, data: { kind: 'entry', label: 'Entrada', event: mode === 'atendimento' ? 'mensagem_recebida' : 'proposta_status_changed' } }]
  if (mode === 'atendimento') nodes.push({ id: 'triagem', type: 'wa', position: { x: 60, y: 200 }, data: { kind: 'form', label: 'Atendimento Mercúrio', text: 'Olá! Sou a MERX, assistente virtual da Mercúrio Capital. Conte como podemos ajudar. Usaremos as informações apenas para seu atendimento.' } })
  else nodes.push({ id: 'dest', type: 'wa', position: { x: 60, y: 200 }, data: { kind: 'recipients', label: 'Envolvidos', roles: ['principal', 'originador'] } }, { id: 'notify', type: 'wa', position: { x: 60, y: 360 }, data: { kind: 'template', label: 'Atualização de proposta', template: 'wa_status_proposta_v1' } })
  nodes.push({ id: 'end', type: 'wa', position: { x: 60, y: mode === 'atendimento' ? 400 : 520 }, data: { kind: 'end', label: 'Fim' } })
  return { nodes, edges: nodes.slice(1).map((n, i) => ({ id: `e${i}`, source: nodes[i].id, target: n.id, sourceHandle: 'next' })), viewport: { x: 0, y: 0, zoom: 1 } }
}

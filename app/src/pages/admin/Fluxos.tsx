import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Plus, Trash2, Save, Play, Loader2, Zap, MessageSquare, Mail, Bell, Smartphone,
  Workflow, X, AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

type Canal = 'in_app' | 'email' | 'whatsapp' | 'push'

interface FluxoAcao {
  tipo: 'notificar'
  template: string
  canais: Canal[]
  titulo?: string
  link?: string
}

interface FluxoCondicaoRegra {
  field: string
  op: '=' | '!=' | '>' | '<' | 'in'
  value: string
}

interface FluxoCondicoes {
  all?: FluxoCondicaoRegra[]
  _layout?: { positions: Record<string, { x: number; y: number }> }
}

interface Fluxo {
  id: string
  nome: string
  descricao: string | null
  trigger_evento: string
  condicoes: FluxoCondicoes
  acoes: FluxoAcao[]
  ativo: boolean
  execucoes_total: number
  ultima_execucao: string | null
  created_at: string
  updated_at: string
}

interface Template {
  id: string
  codigo: string
  canal: Canal
  nome: string
  ativo: boolean
}

interface Execucao {
  id: string
  fluxo_id: string
  fluxo_nome: string
  gatilho: string
  status: 'sucesso' | 'erro' | 'parcial'
  duracao_ms: number | null
  iniciado_em: string
  resultado: { acoes?: object[] }
}

const TRIGGER_EVENTOS = [
  'pendencia_aberta', 'proposta_status_changed', 'partner_aprovado',
  'saldo_baixo', 'manual', 'cron_diario',
]

const CANAL_ICON: Record<Canal, React.ElementType> = {
  in_app: Bell, email: Mail, whatsapp: MessageSquare, push: Smartphone,
}

function TriggerNode({ data }: NodeProps) {
  const d = data as { evento: string }
  return (
    <div className="rounded-lg border-2 border-gold bg-white px-4 py-3 shadow-md min-w-[220px]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gold-600">
        <Zap className="h-3 w-3" /> Gatilho
      </div>
      <div className="mt-1 text-sm font-bold text-navy"><code>{d.evento}</code></div>
      <Handle type="source" position={Position.Bottom} className="!bg-gold" />
    </div>
  )
}

function ActionNode({ data }: NodeProps) {
  const d = data as { template: string; canais: Canal[]; templateNome?: string; invalid?: boolean }
  return (
    <div className={`rounded-lg border-2 ${d.invalid ? 'border-red-400' : 'border-chart-blue'} bg-white px-4 py-3 shadow-md min-w-[220px]`}>
      <Handle type="target" position={Position.Top} className="!bg-chart-blue" />
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-chart-blue">
        <Workflow className="h-3 w-3" /> Notificar
      </div>
      <div className="mt-1 text-sm font-semibold text-navy truncate">
        {d.templateNome ?? d.template ?? '(escolha template)'}
      </div>
      <div className="mt-1 flex gap-1">
        {d.canais?.map(c => {
          const I = CANAL_ICON[c]
          return <span key={c} className="inline-flex items-center gap-0.5 rounded bg-silver-100 px-1.5 py-0.5 text-[10px]"><I className="h-2.5 w-2.5" /> {c}</span>
        })}
      </div>
    </div>
  )
}

const NODE_TYPES = { trigger: TriggerNode, action: ActionNode }

function fluxoToFlow(f: Fluxo, templates: Template[]): { nodes: Node[]; edges: Edge[] } {
  const layout = f.condicoes?._layout?.positions ?? {}
  const nodes: Node[] = [
    {
      id: 'trigger', type: 'trigger',
      position: layout['trigger'] ?? { x: 40, y: 40 },
      data: { evento: f.trigger_evento },
    },
    ...f.acoes.map((a, i) => {
      const tpl = templates.find(t => t.codigo === a.template)
      return {
        id: `action-${i}`, type: 'action',
        position: layout[`action-${i}`] ?? { x: 40 + i * 260, y: 220 },
        data: {
          template: a.template, canais: a.canais ?? ['in_app'],
          templateNome: tpl?.nome, invalid: !tpl,
        },
      } as Node
    }),
  ]
  const edges: Edge[] = f.acoes.map((_, i) => ({
    id: `e-trigger-action-${i}`, source: 'trigger', target: `action-${i}`, animated: true,
  }))
  return { nodes, edges }
}

function flowToFluxoPatch(nodes: Node[], baseCondicoes: FluxoCondicoes) {
  const actionNodes = nodes.filter(n => n.type === 'action')
  const acoes: FluxoAcao[] = actionNodes.map(n => {
    const d = n.data as { template: string; canais: Canal[]; titulo?: string; link?: string }
    return { tipo: 'notificar', template: d.template, canais: d.canais ?? ['in_app'], titulo: d.titulo, link: d.link }
  })
  const positions: Record<string, { x: number; y: number }> = {}
  nodes.forEach(n => { positions[n.id] = n.position })
  return { acoes, condicoes: { ...baseCondicoes, _layout: { positions } } as FluxoCondicoes }
}

export function AdminFluxos() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [triggerEvento, setTriggerEvento] = useState('manual')
  const [ativo, setAtivo] = useState(true)
  const [rules, setRules] = useState<FluxoCondicaoRegra[]>([])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const fluxosQuery = useQuery({
    queryKey: ['admin-fluxos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_fluxos').select('*').order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Fluxo[]
    },
  })
  const fluxos = fluxosQuery.data ?? []

  const templatesQuery = useQuery({
    queryKey: ['admin-templates-min'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_templates').select('id,codigo,canal,nome,ativo').eq('ativo', true)
      if (error) throw error
      return (data ?? []) as Template[]
    },
  })
  const templates = templatesQuery.data ?? []

  const selected = useMemo(
    () => selectedId ? fluxos.find(f => f.id === selectedId) ?? null : fluxos[0] ?? null,
    [fluxos, selectedId],
  )

  const execucoesQuery = useQuery({
    enabled: !!selected,
    queryKey: ['admin-fluxo-execucoes', selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_fluxo_execucoes').select('*')
        .eq('fluxo_id', selected!.id).order('iniciado_em', { ascending: false }).limit(10)
      if (error) throw error
      return (data ?? []) as Execucao[]
    },
  })

  useEffect(() => {
    if (!selected) {
      setNome(''); setDescricao(''); setTriggerEvento('manual'); setAtivo(true); setRules([])
      setNodes([]); setEdges([]); setDirty(false)
      return
    }
    setNome(selected.nome)
    setDescricao(selected.descricao ?? '')
    setTriggerEvento(selected.trigger_evento)
    setAtivo(selected.ativo)
    setRules(selected.condicoes?.all ?? [])
    const { nodes: n, edges: e } = fluxoToFlow(selected, templates)
    setNodes(n); setEdges(e)
    setDirty(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, templates.length])

  const upsertMut = useMutation({
    mutationFn: async () => {
      const patch = flowToFluxoPatch(nodes, { all: rules })
      const { data, error } = await supabase.rpc('admin_fluxo_upsert', {
        p_nome: nome,
        p_trigger_evento: triggerEvento,
        p_id: selected?.id ?? null,
        p_descricao: descricao || null,
        p_condicoes: patch.condicoes,
        p_acoes: patch.acoes,
        p_ativo: ativo,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['admin-fluxos'] })
      setSelectedId(id); setDirty(false)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_fluxo_delete', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fluxos'] })
      setSelectedId(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const executarMut = useMutation({
    mutationFn: async () => {
      if (!selected) return
      const { data, error } = await supabase.rpc('admin_fluxo_executar', {
        p_fluxo_id: selected.id, p_usuario_id: null, p_payload: {},
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fluxo-execucoes', selected?.id] })
      qc.invalidateQueries({ queryKey: ['admin-fluxos'] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  const onConnect = useCallback((c: Connection) => {
    setEdges(eds => addEdge({ ...c, animated: true }, eds))
    setDirty(true)
  }, [setEdges])

  function addActionNode() {
    const i = nodes.filter(n => n.type === 'action').length
    const id = `action-${Date.now()}`
    setNodes(ns => [...ns, {
      id, type: 'action',
      position: { x: 40 + i * 260, y: 220 + (i % 2) * 60 },
      data: { template: templates[0]?.codigo ?? '', canais: ['in_app'] as Canal[], templateNome: templates[0]?.nome },
    }])
    setEdges(es => [...es, { id: `e-trigger-${id}`, source: 'trigger', target: id, animated: true }])
    setDirty(true)
  }

  function updateActionNode(id: string, patch: Partial<{ template: string; canais: Canal[] }>) {
    setNodes(ns => ns.map(n => {
      if (n.id !== id) return n
      const next: Record<string, unknown> = { ...n.data, ...patch }
      if (patch.template) {
        const tpl = templates.find(t => t.codigo === patch.template)
        next.templateNome = tpl?.nome
        next.invalid = !tpl
      }
      return { ...n, data: next }
    }))
    setDirty(true)
  }

  function removeActionNode(id: string) {
    setNodes(ns => ns.filter(n => n.id !== id))
    setEdges(es => es.filter(e => e.target !== id && e.source !== id))
    setDirty(true)
  }

  function startNew() {
    setSelectedId(null)
    setNome('Novo fluxo'); setDescricao(''); setTriggerEvento('manual'); setAtivo(true); setRules([])
    setNodes([{ id: 'trigger', type: 'trigger', position: { x: 40, y: 40 }, data: { evento: 'manual' } }])
    setEdges([])
    setDirty(true)
  }

  useEffect(() => {
    setNodes(ns => ns.map(n => n.type === 'trigger' ? { ...n, data: { ...n.data, evento: triggerEvento } } : n))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerEvento])

  const actionNodes = nodes.filter(n => n.type === 'action')

  return (
    <>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Fluxos automatizados</h1>
          <p className="text-sm text-silver-500">Editor visual com React Flow. Canais ativos: <b>in-app</b>, <b>e-mail</b> e <b>WhatsApp</b> (push deferido).</p>
        </div>
        <button className="btn-gold" onClick={startNew}><Plus className="h-4 w-4" /> Novo fluxo</button>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {fluxosQuery.isLoading ? (
            <div className="card flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-silver-500" /></div>
          ) : fluxos.length === 0 ? (
            <div className="card p-4 text-sm text-silver-500">Sem fluxos cadastrados.</div>
          ) : fluxos.map(f => (
            <button key={f.id} onClick={() => setSelectedId(f.id)}
              className={`card w-full text-left cursor-pointer p-3 transition-colors ${(selected?.id === f.id) ? 'border-l-4 border-gold' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-silver-900 truncate">{f.nome}</p>
                <Badge variant={f.ativo ? 'green' : 'gray'}>{f.ativo ? 'on' : 'off'}</Badge>
              </div>
              <p className="mt-1 text-xs text-silver-500">⚡ <code>{f.trigger_evento}</code></p>
              <p className="mt-1 text-xs text-silver-500">{f.execucoes_total} execuções</p>
            </button>
          ))}
        </aside>

        <div className="card p-4">
          {!selected && !dirty ? (
            <div className="flex h-64 items-center justify-center text-silver-500">
              Selecione um fluxo ou clique em "Novo fluxo".
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_120px]">
                <input className="input text-lg font-bold" value={nome}
                  onChange={e => { setNome(e.target.value); setDirty(true) }} placeholder="Nome do fluxo" />
                <select className="input" value={triggerEvento}
                  onChange={e => { setTriggerEvento(e.target.value); setDirty(true) }}>
                  {TRIGGER_EVENTOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="inline-flex items-center justify-center gap-2 text-sm">
                  <input type="checkbox" className="accent-gold" checked={ativo}
                    onChange={e => { setAtivo(e.target.checked); setDirty(true) }} /> Ativo
                </label>
              </div>

              <input className="input mb-3" value={descricao}
                onChange={e => { setDescricao(e.target.value); setDirty(true) }}
                placeholder="Descrição (opcional)" />

              <div className="h-[420px] rounded-lg border border-silver-200 bg-silver-50">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={(c) => { onNodesChange(c); setDirty(true) }}
                  onEdgesChange={(c) => { onEdgesChange(c); setDirty(true) }}
                  onConnect={onConnect}
                  nodeTypes={NODE_TYPES}
                  fitView
                  proOptions={{ hideAttribution: true }}
                >
                  <Background />
                  <Controls />
                  <MiniMap pannable zoomable />
                </ReactFlow>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-silver-700">Ações ({actionNodes.length})</h3>
                <button className="btn-outline h-8" onClick={addActionNode}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar ação
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {actionNodes.map(n => {
                  const d = n.data as { template: string; canais: Canal[] }
                  return (
                    <div key={n.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-silver-200 p-2 text-sm">
                      <span className="text-xs text-silver-500 w-12">#{n.id.slice(-4)}</span>
                      <select className="input h-8 flex-1 min-w-[200px]" value={d.template}
                        onChange={e => updateActionNode(n.id, { template: e.target.value })}>
                        <option value="">— escolha template —</option>
                        {templates.map(t => <option key={t.codigo} value={t.codigo}>{t.nome} ({t.codigo})</option>)}
                      </select>
                      <div className="flex gap-1">
                        {(['in_app', 'email', 'whatsapp'] as Canal[]).map(c => {
                          const on = d.canais?.includes(c)
                          const Icon = CANAL_ICON[c]
                          return (
                            <button key={c}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${on ? 'border-gold bg-gold/10 text-gold-700' : 'border-silver-300 text-silver-600'}`}
                              onClick={() => {
                                const next = on ? d.canais.filter(x => x !== c) : [...(d.canais ?? []), c]
                                updateActionNode(n.id, { canais: next })
                              }}>
                              <Icon className="h-3 w-3" /> {c}
                            </button>
                          )
                        })}
                      </div>
                      <button className="btn-ghost h-7 px-2 text-red-600" onClick={() => removeActionNode(n.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-silver-700">Condições (AND)</h3>
                <div className="mt-2 space-y-2">
                  {rules.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-silver-50 p-2 text-sm">
                      <input className="input h-8 w-40" placeholder="campo" value={r.field}
                        onChange={e => { const n = [...rules]; n[i] = { ...r, field: e.target.value }; setRules(n); setDirty(true) }} />
                      <select className="input h-8 w-20" value={r.op}
                        onChange={e => { const n = [...rules]; n[i] = { ...r, op: e.target.value as FluxoCondicaoRegra['op'] }; setRules(n); setDirty(true) }}>
                        {(['=', '!=', '>', '<', 'in'] as const).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input className="input h-8 flex-1" placeholder="valor" value={r.value}
                        onChange={e => { const n = [...rules]; n[i] = { ...r, value: e.target.value }; setRules(n); setDirty(true) }} />
                      <button className="btn-ghost h-7 px-2 text-red-600"
                        onClick={() => { setRules(rules.filter((_, j) => j !== i)); setDirty(true) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button className="text-sm font-medium text-gold-600"
                    onClick={() => { setRules([...rules, { field: '', op: '=', value: '' }]); setDirty(true) }}>
                    + Adicionar condição
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-silver-100 pt-3">
                <div className="flex gap-2">
                  {selected && (
                    <button className="btn-outline" onClick={() => executarMut.mutate()} disabled={executarMut.isPending}>
                      {executarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Executar teste
                    </button>
                  )}
                  {selected && (
                    <button className="btn-ghost text-red-600"
                      onClick={() => { if (confirm(`Remover "${selected.nome}"?`)) deleteMut.mutate(selected.id) }}>
                      <Trash2 className="h-4 w-4" /> Remover
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {dirty && <span className="text-xs text-amber-600">Alterações não salvas</span>}
                  <button className="btn-gold" onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending || !nome}>
                    {upsertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </button>
                </div>
              </div>

              {selected && (
                <div className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold text-silver-700">Últimas execuções</h3>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-silver-500">
                      <tr>
                        <th className="py-2">Quando</th>
                        <th className="py-2">Gatilho</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Duração</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(execucoesQuery.data ?? []).map(e => (
                        <tr key={e.id} className="border-t border-silver-100">
                          <td className="py-2 text-silver-600">{new Date(e.iniciado_em).toLocaleString('pt-BR')}</td>
                          <td className="py-2 text-silver-700"><code className="text-xs">{e.gatilho}</code></td>
                          <td className="py-2">
                            <Badge variant={e.status === 'sucesso' ? 'green' : e.status === 'erro' ? 'red' : 'amber'}>{e.status}</Badge>
                          </td>
                          <td className="py-2 text-silver-600">{e.duracao_ms ? `${e.duracao_ms}ms` : '—'}</td>
                        </tr>
                      ))}
                      {!execucoesQuery.data?.length && (
                        <tr><td colSpan={4} className="py-3 text-center text-xs text-silver-500">Sem execuções registradas.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

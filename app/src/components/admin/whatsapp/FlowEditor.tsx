import { memo, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type NodeProps,
  type Connection,
  type Edge,
  type Viewport,
} from '@xyflow/react'
import { Maximize2, Minimize2, Plus, Trash2, X } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import './FlowEditor.css'
import { supabase } from '@/lib/supabase'
import {
  EVENTS,
  KINDS,
  ROLES,
  initialGraph,
  validateGraph,
  traceGraph,
  compileNativeFlow,
  type FlowNode,
  type FlowEdge,
  type Graph,
  type Kind,
} from '@/lib/whatsappFlow'
import { whatsappAction } from './api'

const names: Record<Kind, string> = {
  entry: 'Entrada',
  condition: 'Condição',
  recipients: 'Destinatários',
  template: 'Notificação',
  reply: 'Resposta',
  menu: 'Menu',
  form: 'Formulário Meta',
  handoff: 'Equipe humana',
  end: 'Fim',
}

const FlowCard = memo(function FlowCard({ id, data, selected }: NodeProps) {
  const flow = useReactFlow()
  const d = data as FlowNode['data']
  const handles = d.kind === 'condition'
    ? ['yes', 'no']
    : d.kind === 'menu'
      ? ((d.options ?? []) as { id: string }[]).map(option => option.id)
      : ['next']

  return (
    <article className={`wa-flow-node${selected ? ' is-selected' : ''}`}>
      {d.kind !== 'entry' && <Handle type="target" position={Position.Top} />}
      {d.kind !== 'entry' && (
        <button
          type="button"
          className="btn-no-liquid wa-flow-node__remove nodrag nopan"
          aria-label={`Remover nó ${d.label}`}
          title="Remover nó e conexões"
          onClick={event => {
            event.stopPropagation()
            void flow.deleteElements({ nodes: [{ id }] })
          }}
        >
          <X size={13} />
        </button>
      )}
      <p className="wa-flow-node__kind">{names[d.kind]}</p>
      <p className="wa-flow-node__title">{d.label}</p>
      <p className="wa-flow-node__detail">{String(d.template || d.text || d.event || 'Configure este passo')}</p>
      {!['end', 'handoff'].includes(d.kind) && handles.map((handle, index) => (
        <Handle
          key={handle}
          id={handle}
          type="source"
          position={Position.Bottom}
          style={{ left: `${(index + 1) * 100 / (handles.length + 1)}%` }}
          title={handle}
        />
      ))}
    </article>
  )
})

const nodeTypes = { wa: FlowCard }

function ZoomControls() {
  const flow = useReactFlow()
  return (
    <div className="wa-flow-zoom" role="group" aria-label="Controles de zoom">
      <button type="button" className="btn-no-liquid" aria-label="Aumentar zoom" onClick={() => void flow.zoomIn()}>+</button>
      <button type="button" className="btn-no-liquid" aria-label="Diminuir zoom" onClick={() => void flow.zoomOut()}>−</button>
      <button type="button" className="btn-no-liquid" onClick={() => void flow.fitView({ padding: 0.2 })}>Enquadrar</button>
    </div>
  )
}

type Row = {
  id: string
  nome: string
  modo: 'notificacao' | 'atendimento'
  ativo: boolean
  rascunho: Graph
  whatsapp_versao_id: string | null
}

export function WhatsAppFlowEditor() {
  const qc = useQueryClient()
  const [id, setId] = useState<string | null>(null)
  const [name, setName] = useState('Novo fluxo')
  const [mode, setMode] = useState<'notificacao' | 'atendimento'>('notificacao')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialGraph('notificacao').nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialGraph('notificacao').edges)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [simStatus, setSimStatus] = useState('pre_analise')
  const [simProduct, setSimProduct] = useState('home_equity')
  const [fullscreen, setFullscreen] = useState(true)

  const query = useQuery({
    queryKey: ['wa-flows'],
    queryFn: async () => {
      const result = await supabase.from('fluxos_evolution')
        .select('id,nome,modo,ativo,rascunho,whatsapp_versao_id')
        .not('modo', 'is', null)
        .order('updated_at', { ascending: false })
      if (result.error) throw result.error
      return result.data as Row[]
    },
  })
  const templates = useQuery({
    queryKey: ['wa-template-codes'],
    queryFn: async () => {
      const result = await supabase.from('templates_mensagem').select('codigo,nome').eq('canal', 'whatsapp')
      if (result.error) throw result.error
      return result.data
    },
  })

  const graph = (): Graph => ({ nodes: nodes as FlowNode[], edges, viewport })
  const active = nodes.find(node => node.id === selected)
  const canvasNodes = nodes.map(node => ({ ...node, deletable: node.data.kind !== 'entry' }))
  const displayEdges: Edge[] = edges.map(edge => ({
    ...edge,
    animated: true,
    style: { stroke: '#ef3445', strokeWidth: 2.5 },
  }))

  useEffect(() => {
    if (!fullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [fullscreen])

  function patch(data: Record<string, unknown>) {
    setNodes(current => current.map(node => node.id === selected
      ? { ...node, data: { ...node.data, ...data } }
      : node))
    setDirty(true)
  }

  function load(row?: Row, nextMode = mode) {
    if (dirty && !window.confirm('Descartar as alterações do rascunho?')) return
    const nextGraph = row?.rascunho ?? initialGraph(nextMode)
    setId(row?.id ?? null)
    setName(row?.nome ?? 'Novo fluxo')
    setMode(row?.modo ?? nextMode)
    setNodes(nextGraph.nodes)
    setEdges(nextGraph.edges)
    setViewport(nextGraph.viewport)
    setVersion(row?.whatsapp_versao_id ?? null)
    setSelected(null)
    setDirty(false)
    setMessage('')
    setPreview('')
  }

  const connect = useCallback((connection: Connection) => {
    setEdges(current => addEdge(connection, current))
    setDirty(true)
  }, [setEdges])

  function add(kind: Kind) {
    const node: FlowNode = {
      id: crypto.randomUUID(),
      type: 'wa',
      position: { x: 350, y: nodes.length * 65 },
      data: {
        kind,
        label: names[kind],
        ...(kind === 'condition' ? { field: 'status', op: '=', value: 'pre_analise' } : {}),
        ...(kind === 'recipients' ? { roles: ['principal'] } : {}),
        ...(['reply', 'menu', 'form'].includes(kind) ? { text: 'Como podemos ajudar?' } : {}),
        ...(kind === 'menu' ? { options: [{ id: 'humano', title: 'Falar com a equipe' }] } : {}),
        ...(kind === 'template' ? { template: 'wa_status_proposta_v1' } : {}),
      },
    }
    setNodes(current => [...current, node])
    setSelected(node.id)
    setDirty(true)
  }

  function removeNode(nodeId: string) {
    if (nodes.find(node => node.id === nodeId)?.data.kind === 'entry') return
    setNodes(current => current.filter(node => node.id !== nodeId))
    setEdges(current => current.filter(edge => edge.source !== nodeId && edge.target !== nodeId))
    setSelected(null)
    setDirty(true)
  }

  async function run(action: string) {
    setBusy(true)
    setMessage('')
    try {
      if (action === 'simular_fluxo') {
        const path = traceGraph(graph(), mode, {
          evento: String(nodes.find(node => node.data.kind === 'entry')?.data.event ?? ''),
          status: simStatus,
          produto: simProduct,
        })
        setPreview(path.map(node => `${names[node.data.kind]}: ${node.data.label}`).join('\n'))
        setMessage('Simulação local: nenhuma mensagem foi enfileirada.')
        return
      }
      if (action === 'preview_flow_meta' && !version) {
        setPreview(JSON.stringify(compileNativeFlow(graph()), null, 2))
        return
      }
      const result = await whatsappAction({
        action,
        id: ['salvar_fluxo', 'publicar_fluxo'].includes(action) ? id : version,
        name,
        mode,
        graph: graph(),
      })
      if (result.id) {
        setId(result.id)
        setDirty(false)
      }
      if (result.flow_json) setPreview(JSON.stringify(result.flow_json, null, 2))
      if (result.errors?.length) throw new Error(JSON.stringify(result.errors))
      await qc.invalidateQueries({ queryKey: ['wa-flows'] })
      if (result.id) {
        const saved = await supabase.from('fluxos_evolution').select('whatsapp_versao_id').eq('id', result.id).single()
        setVersion(saved.data?.whatsapp_versao_id ?? null)
      }
      setMessage('Operação concluída. Publicar uma versão interna não ativa envios nem publica na Meta.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha na operação.')
    } finally {
      setBusy(false)
    }
  }

  const errors = validateGraph(graph(), mode)
  const availableKinds = KINDS.filter(kind => ![
    'entry',
    ...(mode === 'notificacao' ? ['reply', 'menu', 'form', 'handoff'] : ['recipients', 'template']),
  ].includes(kind))

  const flowList = (
    <aside className="wa-flow-list" aria-label="Fluxos salvos">
      <button type="button" className="btn-no-liquid wa-flow-list__new" onClick={() => load()}>
        <Plus size={15} /> Novo fluxo
      </button>
      {query.isLoading && <p className="wa-flow-muted">Carregando fluxos…</p>}
      {query.isError && <p role="alert" className="wa-flow-error">Não foi possível carregar. Verifique as migrations do WhatsApp.</p>}
      {query.data?.length === 0 && <p className="wa-flow-muted">Nenhum fluxo cadastrado.</p>}
      {query.data?.map(flow => (
        <article key={flow.id} className={`wa-flow-list__item${id === flow.id ? ' is-active' : ''}`}>
          <button type="button" className="btn-no-liquid wa-flow-list__select" onClick={() => load(flow)}>
            <strong>{flow.nome}</strong>
            <span>{flow.modo === 'atendimento' ? 'Atendimento' : 'Notificação'} · {flow.ativo ? 'Ativo' : 'Pausado'}</span>
          </button>
          <button
            type="button"
            className="btn-no-liquid wa-flow-list__toggle"
            disabled={busy || !flow.whatsapp_versao_id}
            onClick={async () => {
              try {
                await whatsappAction({ action: 'ativar_fluxo', id: flow.id, ativo: !flow.ativo })
                await query.refetch()
              } catch (error) {
                setMessage(String(error))
              }
            }}
          >{flow.ativo ? 'Pausar' : 'Ativar versão publicada'}</button>
        </article>
      ))}
    </aside>
  )

  const inspector = active ? (
    <fieldset className="wa-flow-inspector">
      <legend>Editar nó · {names[active.data.kind as Kind]}</legend>
      <label>Título<input className="input" value={String(active.data.label)} onChange={event => patch({ label: event.target.value })} /></label>
      {active.data.kind === 'entry' && <label>Evento<select className="input" value={String(active.data.event)} onChange={event => patch({ event: event.target.value })}>{EVENTS.filter(event => mode === 'atendimento' ? event === 'mensagem_recebida' : event !== 'mensagem_recebida').map(event => <option key={event}>{event}</option>)}</select></label>}
      {active.data.kind === 'template' && <label>Template<select className="input" value={String(active.data.template || '')} onChange={event => patch({ template: event.target.value })}>{templates.data?.map(template => <option key={template.codigo} value={template.codigo}>{template.nome}</option>)}</select></label>}
      {active.data.kind === 'recipients' && <div className="wa-flow-inspector__roles">{ROLES.map(role => <label key={role}><input type="checkbox" checked={(active.data.roles as string[]).includes(role)} onChange={event => patch({ roles: event.target.checked ? [...active.data.roles as string[], role] : (active.data.roles as string[]).filter(value => value !== role) })} /> {role}</label>)}</div>}
      {['reply', 'form', 'menu'].includes(String(active.data.kind)) && <label>Mensagem<textarea className="input min-h-20" value={String(active.data.text || '')} maxLength={2000} onChange={event => patch({ text: event.target.value })} /></label>}
      {active.data.kind === 'condition' && <>
        <label>Campo<select className="input" value={String(active.data.field)} onChange={event => patch({ field: event.target.value })}>{['evento', 'status', 'produto'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Operador<select className="input" value={String(active.data.op)} onChange={event => patch({ op: event.target.value })}>{['=', '!=', 'in'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Valor<input className="input" value={String(active.data.value)} onChange={event => patch({ value: event.target.value })} /></label>
        <p className="wa-flow-muted">Saídas: yes = verdadeiro; no = falso.</p>
      </>}
      {active.data.kind === 'menu' && (
        <label>
          Opções (id | título, uma por linha)
          <textarea
            className="input"
            value={(active.data.options as { id: string; title: string }[]).map(option => `${option.id} | ${option.title}`).join('\n')}
            onChange={event => patch({
              options: event.target.value.split('\n').map(line => {
                const [optionId, title] = line.split('|')
                return { id: optionId.trim(), title: title?.trim() || '' }
              }),
            })}
          />
        </label>
      )}
      {active.data.kind !== 'entry' && <button type="button" className="btn-no-liquid wa-flow-danger" onClick={() => removeNode(active.id)}><Trash2 size={15} /> Remover nó e conexões</button>}
    </fieldset>
  ) : <div className="wa-flow-inspector wa-flow-inspector--empty"><strong>Selecione um nó</strong><span>Edite o conteúdo ou use o botão no cartão para removê-lo.</span></div>

  const actionPanel = (
    <div className="wa-flow-actions">
      <div className="wa-flow-actions__buttons">
        <button type="button" className="btn-no-liquid" disabled={busy || errors.length > 0} onClick={() => void run('salvar_fluxo')}>Salvar rascunho</button>
        <button type="button" className="btn-no-liquid wa-flow-primary" disabled={busy || errors.length > 0} onClick={() => void run('publicar_fluxo')}>Publicar versão interna</button>
        <label>Status de exemplo<input aria-label="Status de exemplo" className="input" value={simStatus} onChange={event => setSimStatus(event.target.value)} /></label>
        <label>Produto de exemplo<input aria-label="Produto de exemplo" className="input" value={simProduct} onChange={event => setSimProduct(event.target.value)} /></label>
        <button type="button" className="btn-no-liquid" disabled={busy || errors.length > 0} onClick={() => void run('simular_fluxo')}>Simular sem enviar</button>
      </div>
      {mode === 'atendimento' && <div className="wa-flow-actions__buttons wa-flow-actions__meta">{[
        ['preview_flow_meta', 'Prévia Flow JSON'],
        ['rascunho_flow_meta', 'Criar/validar rascunho Meta'],
        ['sincronizar_flow_meta', 'Sincronizar Meta'],
        ['publicar_flow_meta', 'Publicar formulário na Meta'],
      ].map(([action, title]) => <button key={action} type="button" className="btn-no-liquid" disabled={busy || dirty || (action !== 'preview_flow_meta' && !version)} onClick={() => {
        if (action === 'publicar_flow_meta' && !window.confirm('Publicar este formulário na conta Meta vinculada? A publicação externa é uma ação separada da versão interna.')) return
        void run(action)
      }}>{title}</button>)}</div>}
      {errors.length > 0 && <ul className="wa-flow-validation">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      {message && <p role="status" className="wa-flow-message">{message}</p>}
      {preview && <pre className="wa-flow-preview">{preview}</pre>}
    </div>
  )

  return (
    <section className={`wa-flow-editor${fullscreen ? ' wa-flow-editor--fullscreen' : ''}`}>
      <header className="wa-flow-header">
        <div>
          <p className="wa-flow-eyebrow">WhatsApp Business</p>
          <h1>Fluxos de notificações e atendimento</h1>
          <p>Rascunho, versão interna e publicação Meta são etapas independentes.</p>
        </div>
        <div className="wa-flow-header__actions">
          {!fullscreen && <Link className="btn-no-liquid" to="/admin/templates?canal=whatsapp">Templates WhatsApp</Link>}
          <button type="button" className="btn-no-liquid wa-flow-fullscreen" onClick={() => setFullscreen(value => !value)} aria-label={fullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}>
            {fullscreen ? <><Minimize2 size={16} /> Sair da tela cheia</> : <><Maximize2 size={16} /> Tela cheia</>}
          </button>
          {fullscreen && <Link className="btn-no-liquid" to="/admin/templates?canal=whatsapp">Templates</Link>}
        </div>
      </header>

      <div className="wa-flow-workspace">
        {flowList}
        <main className="wa-flow-main">
          <div className="wa-flow-config">
            <label>Nome<input className="input" value={name} maxLength={120} onChange={event => { setName(event.target.value); setDirty(true) }} /></label>
            <label>Modo<select className="input" value={mode} onChange={event => load(undefined, event.target.value as typeof mode)}><option value="notificacao">Automação de notificações</option><option value="atendimento">Atendimento conversacional</option></select></label>
            <span className={`wa-flow-dirty${dirty ? ' is-dirty' : ''}`}>{dirty ? 'Alterações não salvas' : 'Rascunho sincronizado'}</span>
          </div>
          <div className="wa-flow-kindbar" aria-label="Adicionar etapa">
            <span>Adicionar etapa</span>
            {availableKinds.map(kind => <button key={kind} type="button" className="btn-no-liquid" onClick={() => add(kind)}><Plus size={14} /> {names[kind]}</button>)}
          </div>
          <div className="wa-flow-body">
            <div className="wa-flow-canvas" aria-label="Canvas do fluxo">
              <ReactFlow
                nodes={canvasNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                viewport={viewport}
                onViewportChange={setViewport}
                onNodesChange={changes => { onNodesChange(changes); setDirty(true) }}
                onEdgesChange={changes => { onEdgesChange(changes); setDirty(true) }}
                onConnect={connect}
                onNodeClick={(_, node) => setSelected(node.id)}
                onPaneClick={() => setSelected(null)}
                onNodesDelete={deleted => {
                  setDirty(true)
                  if (deleted.some(node => node.id === selected)) setSelected(null)
                }}
                isValidConnection={connection => connection.source !== connection.target && !edges.some(edge => edge.source === connection.source && edge.sourceHandle === connection.sourceHandle)}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                minZoom={0.2}
                maxZoom={1.7}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#282a31" gap={22} size={1} />
                <ZoomControls />
              </ReactFlow>
            </div>
            <aside className="wa-flow-inspector-dock" aria-label="Propriedades do nó">{inspector}</aside>
          </div>
          {actionPanel}
        </main>
      </div>
    </section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyNodeChanges, Background, Handle, MiniMap, Position, ReactFlow,
  type Connection, type Edge, type Node, type NodeProps, type ReactFlowInstance,
} from '@xyflow/react'
import { Building2, Crown, Focus, Grip, Maximize2, Network, RotateCcw, Users, ZoomIn, ZoomOut } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import { reconcileNetworkNodes } from '@/lib/networkNodes'

export type NetworkCardData = {
  label: string
  subtitle: string
  detail: string
  kind: 'admin' | 'partner' | 'equipe' | 'person'
  badge?: string
  avatar?: string | null
  actionLabel?: string
  onOpen?: () => void
}
export type NetworkCardNode = Node<NetworkCardData, 'networkCard'>

function NetworkCard({ data, selected }: NodeProps<NetworkCardNode>) {
  const Icon = data.kind === 'admin' ? Crown : data.kind === 'partner' ? Building2 : data.kind === 'equipe' ? Users : Network
  return <article className={`network-node network-node--${data.kind}${selected ? ' is-selected' : ''}`}>
    {data.kind !== 'admin' && <Handle type="target" position={Position.Top} />}
    <header>
      {data.kind === 'person' ? <span className="network-avatar">{data.avatar ? <img src={data.avatar} alt="" /> : data.label.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span> : <span className="network-node__icon"><Icon size={18} /></span>}
      <span className="network-node__identity"><small>{data.kind === 'person' ? 'Equipe Mercúrio' : data.kind === 'admin' ? 'Mercúrio Capital' : data.kind === 'partner' ? 'Parceiro' : 'Equipe'}</small><strong title={data.label}>{data.label}</strong></span>
    </header>
    <p title={data.subtitle}>{data.subtitle}</p>
    <footer><span title={data.detail}>{data.detail}</span>{data.onOpen && <button className="btn-no-liquid nodrag nopan" type="button" aria-label={`Abrir ${data.label}`} onClick={event => { event.stopPropagation(); data.onOpen?.() }}>{data.actionLabel ?? 'Detalhes'} <Maximize2 size={11} /></button>}</footer>
    {data.kind !== 'equipe' && <Handle type="source" position={Position.Bottom} />}
  </article>
}

const nodeTypes = { networkCard: NetworkCard }

export function NetworkCanvas({ nodes: initialNodes, edges, selectedId, highlightedIds, onSelect, onConnect, canConnect, label }: {
  nodes: NetworkCardNode[]
  edges: Edge[]
  selectedId?: string | null
  highlightedIds?: Set<string>
  onSelect?: (id: string) => void
  onConnect?: (connection: Connection) => void
  canConnect?: (connection: { source: string; target: string }) => boolean
  label: string
}) {
  const [nodes, setNodes] = useState<NetworkCardNode[]>(initialNodes)
  const [instance, setInstance] = useState<ReactFlowInstance<NetworkCardNode, Edge> | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250
  const prepared = useMemo(() => initialNodes.map(node => ({
    ...node, deletable: false, selected: node.id === selectedId,
    width: 242, height: 142,
    handles: [
      ...(node.data.kind !== 'admin' ? [{ type: 'target' as const, position: Position.Top, x: 116, y: -5, width: 10, height: 10 }] : []),
      ...(node.data.kind !== 'equipe' ? [{ type: 'source' as const, position: Position.Bottom, x: 116, y: 137, width: 10, height: 10 }] : []),
    ],
    className: highlightedIds && !highlightedIds.has(node.id) ? 'network-node-muted' : '',
    ariaLabel: node.data.label,
    data: { ...node.data, onOpen: onSelect ? () => onSelect(node.id) : undefined },
  })), [initialNodes, selectedId, highlightedIds, onSelect])

  useEffect(() => {
    setNodes(current => reconcileNetworkNodes(current, prepared))
  }, [prepared])

  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(([entry]) => setSize(current => current.width === entry.contentRect.width && current.height === entry.contentRect.height ? current : { width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!instance || !size.width || !size.height) return
    const frame = requestAnimationFrame(() => {
      const node = selectedId ? instance.getNode(selectedId) : instance.getNodes()[0]
      const zoom = selectedId ? .95 : .85
      if (node) void instance.setViewport({ x: size.width / 2 - (node.position.x + 121) * zoom, y: selectedId ? size.height / 2 - (node.position.y + 71) * zoom : 85 - node.position.y * zoom, zoom }, { duration })
    })
    return () => cancelAnimationFrame(frame)
  }, [instance, selectedId, size.width, size.height, duration])

  function reset() {
    setNodes(current => reconcileNetworkNodes(current, prepared, false))
    const first = prepared[0]
    if (first) requestAnimationFrame(() => { void instance?.setViewport({ x: size.width / 2 - (first.position.x + 121) * .85, y: 85 - first.position.y * .85, zoom: .85 }, { duration }) })
  }

  return <div ref={container} className="network-canvas" aria-label={label}>
    <div className="network-canvas__tools" role="group" aria-label="Controles do mapa">
      <button className="btn-no-liquid" type="button" title="Aproximar" aria-label="Aproximar" onClick={() => void instance?.zoomIn()}><ZoomIn size={16} /></button>
      <button className="btn-no-liquid" type="button" title="Afastar" aria-label="Afastar" onClick={() => void instance?.zoomOut()}><ZoomOut size={16} /></button>
      <button className="btn-no-liquid" type="button" onClick={() => void instance?.fitView({ padding: .15, minZoom: .2, maxZoom: .95, duration })}><Focus size={15} /> Enquadrar</button>
      <button className="btn-no-liquid" type="button" onClick={reset}><RotateCcw size={14} /> Reorganizar</button>
    </div>
    {nodes.length ? <ReactFlow<NetworkCardNode, Edge>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={setInstance}
      onNodesChange={changes => setNodes(current => applyNodeChanges(changes, current))}
      onNodeClick={(_, node) => onSelect?.(node.id)}
      onConnect={onConnect} isValidConnection={canConnect}
      nodesConnectable={Boolean(onConnect)} edgesReconnectable={false}
      nodesDraggable nodesFocusable deleteKeyCode={null}
      defaultViewport={{ x: 36, y: 85, zoom: .85 }} minZoom={.15} maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
    ><Background color="#dbdce1" gap={22} size={1} /><MiniMap pannable zoomable nodeColor={node => node.id === selectedId ? '#d7192d' : '#d5d6dc'} maskColor="rgba(246,246,248,.7)" /></ReactFlow>
      : <div className="network-empty"><Network size={30} /><strong>Nenhum registro para exibir</strong><span>Os dados disponíveis aparecerão neste mapa.</span></div>}
    <div className="network-canvas__hint"><Grip size={13} /> Arraste os cards para organizar · Use o fundo para mover o mapa</div>
  </div>
}

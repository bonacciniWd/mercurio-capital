import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { AlertCircle, GripVertical, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { PRODUTO_LABEL, PROPOSTA_KANBAN_STATUS, PROPOSTA_STATUS_LABEL, toKanbanStatus, type PropostaKanbanStatus } from '@/lib/propostaStatus'

type KanbanScope = 'admin' | 'partner'
type ViewMode = 'operacional' | 'rascunhos' | 'canceladas'

interface KanbanCard {
  id: string; protocolo: string | null; produto: string; status: string
  valor_solicitado: number; valor_imoveis_total: number
  created_at: string; updated_at: string; partner_id: string | null
  partner_nome: string | null; cliente_id: string | null; cliente_nome: string | null
}

function diasDesde(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function PropostasKanban({ scope }: { scope: KanbanScope }) {
  const qc = useQueryClient()
  const queryKey = scope === 'admin' ? ['admin-kanban-propostas'] : ['partner-kanban-propostas']
  const listRpc = scope === 'admin' ? 'admin_list_propostas' : 'partner_list_kanban_propostas'
  const statusRpc = scope === 'admin' ? 'admin_set_proposta_status' : 'partner_set_proposta_status'
  const detailBase = scope === 'admin' ? '/admin/propostas' : '/p/propostas'
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null)
  const [busca, setBusca] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('operacional')
  const [feedback, setFeedback] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const { data: propostas = [], isLoading, error } = useQuery({
    queryKey,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<KanbanCard[]> => {
      const { data, error } = await supabase.rpc(listRpc, { p_limit: 500 })
      if (error) throw error
      return ((data ?? []) as KanbanCard[]).map(row => ({
        ...row,
        valor_solicitado: Number(row.valor_solicitado || 0),
        valor_imoveis_total: Number(row.valor_imoveis_total || 0),
      }))
    },
  })

  useEffect(() => {
    const channel = supabase.channel(`${scope}-kanban`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propostas' }, () => { void qc.invalidateQueries({ queryKey }) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [qc, scope])

  const filtradas = useMemo(() => propostas.filter(card => {
    if (viewMode === 'operacional' && (card.status === 'simulacao' || card.status === 'cancelado')) return false
    if (viewMode === 'rascunhos' && card.status !== 'simulacao') return false
    if (viewMode === 'canceladas' && card.status !== 'cancelado') return false
    const term = busca.trim().toLowerCase()
    return !term || [card.protocolo, card.cliente_nome, card.partner_nome, card.produto]
      .filter(Boolean).join(' ').toLowerCase().includes(term)
  }), [busca, propostas, viewMode])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(PROPOSTA_KANBAN_STATUS.map(status => [status, [] as KanbanCard[]])) as Record<PropostaKanbanStatus, KanbanCard[]>
    const naoMapeadas: KanbanCard[] = []
    for (const card of filtradas) {
      const mapped = toKanbanStatus(card.status)
      if (mapped) map[mapped].push(card); else naoMapeadas.push(card)
    }
    return { map, naoMapeadas }
  }, [filtradas])

  async function moverPara(card: KanbanCard, novoStatus: PropostaKanbanStatus) {
    if (card.status === novoStatus) return
    const previous = qc.getQueryData<KanbanCard[]>(queryKey) ?? []
    setFeedback(null)
    qc.setQueryData<KanbanCard[]>(queryKey, old => (old ?? []).map(item =>
      item.id === card.id ? { ...item, status: novoStatus, updated_at: new Date().toISOString() } : item))
    const { error } = await supabase.rpc(statusRpc, { p_id: card.id, p_status: novoStatus, p_motivo: `Movido via Kanban ${scope}` })
    if (error) {
      qc.setQueryData(queryKey, previous)
      setFeedback(error.message.includes('status_transition_not_allowed')
        ? 'Seu perfil não possui permissão para mover a proposta entre essas etapas.'
        : `Falha ao mover proposta: ${error.message}`)
      await qc.invalidateQueries({ queryKey })
    }
  }

  function onDragStart(event: DragStartEvent) {
    setActiveCard(propostas.find(card => card.id === String(event.active.id)) ?? null)
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    if (!event.over) return
    const card = propostas.find(item => item.id === String(event.active.id))
    if (card) void moverPara(card, String(event.over.id) as PropostaKanbanStatus)
  }

  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-navy">Kanban de propostas</h1><p className="text-sm text-silver-600">{scope === 'admin' ? 'Pipeline global da operação.' : 'Pipeline restrito às propostas da sua operação.'}</p></div>
      <Link to={detailBase} className="btn-outline">Ver lista</Link>
    </div>
    <div className="card mb-4 grid gap-3 p-4 md:grid-cols-[1fr_auto]">
      <input className="input" placeholder="Buscar por protocolo, cliente, originador ou operação" value={busca} onChange={event => setBusca(event.target.value)} />
      <div className="flex rounded-md border border-silver-200 p-1" aria-label="Filtro do Kanban">
        {(['operacional', 'rascunhos', 'canceladas'] as ViewMode[]).map(mode => <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`rounded px-3 py-1.5 text-xs font-medium ${viewMode === mode ? 'bg-navy text-white' : 'text-silver-600 hover:bg-silver-50'}`}>{mode === 'operacional' ? 'Operacional' : mode === 'rascunhos' ? 'Rascunhos' : 'Canceladas'}</button>)}
      </div>
    </div>
    {(feedback || error) && <div className="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertCircle className="h-4 w-4" />{feedback ?? (error as Error).message}</div>}
    {isLoading ? <div className="flex items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      : viewMode !== 'operacional' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtradas.map(card => <CardView key={card.id} card={card} detailBase={detailBase} />)}{filtradas.length === 0 && <p className="text-sm text-silver-500">Nenhuma proposta neste filtro.</p>}</div>
      : <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PROPOSTA_KANBAN_STATUS.map(status => <Column key={status} status={status} cards={byStatus.map[status]} detailBase={detailBase} />)}
          {byStatus.naoMapeadas.length > 0 && <div className="w-72 shrink-0"><div className="rounded-t-md bg-silver-700 p-3 text-white"><span className="text-sm font-semibold">Legado / Não mapeado</span></div><div className="min-h-[240px] space-y-2 rounded-b-md bg-silver-100 p-2">{byStatus.naoMapeadas.map(card => <CardView key={card.id} card={card} detailBase={detailBase} />)}</div></div>}
        </div>
        <DragOverlay>{activeCard ? <CardView card={activeCard} detailBase={detailBase} dragging /> : null}</DragOverlay>
      </DndContext>}
  </>
}

function Column({ status, cards, detailBase }: { status: PropostaKanbanStatus; cards: KanbanCard[]; detailBase: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const total = cards.reduce((sum, card) => sum + card.valor_solicitado, 0)
  return <div className="w-72 shrink-0"><div className="rounded-t-md bg-navy p-3 text-white"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{PROPOSTA_STATUS_LABEL[status]}</span><span className="rounded bg-white/15 px-2 py-0.5 text-xs">{cards.length}</span></div><p className="mt-1 text-xs text-white/70">{brl(total * 100)}</p></div><div ref={setNodeRef} className={`min-h-[240px] space-y-2 rounded-b-md p-2 ${isOver ? 'bg-gold/10' : 'bg-silver-100'}`}>{cards.map(card => <DraggableCard key={card.id} card={card} detailBase={detailBase} />)}</div></div>
}

function DraggableCard({ card, detailBase }: { card: KanbanCard; detailBase: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? 'opacity-40' : ''}><CardView card={card} detailBase={detailBase} /></div>
}

function CardView({ card, detailBase, dragging }: { card: KanbanCard; detailBase: string; dragging?: boolean }) {
  const dias = diasDesde(card.created_at)
  const isLegacy = toKanbanStatus(card.status) !== card.status
  return <div className={`card overflow-hidden ${dragging ? 'rotate-1 shadow-xl' : 'cursor-grab active:cursor-grabbing'}`}><div className="p-3"><div className="flex items-start gap-2"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-silver-400" /><div className="min-w-0 flex-1"><p className="font-mono text-xs text-silver-500">{card.protocolo || card.id.slice(0, 8)}</p><Link to={`${detailBase}/${card.id}`} onPointerDown={event => event.stopPropagation()} className="mt-1 block truncate text-sm font-semibold text-silver-900 hover:text-gold-700">{card.cliente_nome || 'Cliente não informado'}</Link><p className="mt-1 truncate text-xs text-silver-600">Originador: {card.partner_nome || '—'}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-silver-400">Imóvel</dt><dd className="font-medium text-silver-700">{brl(card.valor_imoveis_total * 100)}</dd></div><div><dt className="text-silver-400">Na esteira</dt><dd className={dias > 7 ? 'font-semibold text-danger' : 'font-medium text-silver-700'}>{dias} dias</dd></div></dl>{isLegacy && <p className="mt-2 text-[10px] font-medium text-gold-700">{PROPOSTA_STATUS_LABEL[card.status]}</p>}</div></div></div><div className="border-t border-silver-100 bg-silver-50 px-3 py-2 text-[11px] font-semibold text-silver-600">{PRODUTO_LABEL[card.produto] ?? card.produto}</div></div>
}
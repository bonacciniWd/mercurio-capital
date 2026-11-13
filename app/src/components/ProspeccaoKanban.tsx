// Board Kanban do funil de prospecção de parceiros (issue #34 — spec UX/UI aprovada).
// Copia-adapta o padrão de PropostasKanban: PointerSensor distance 6, move otimista
// (cache + rollback + banner no conflito 40001), pan do board + scrollbar superior
// sincronizada, coluna com badge de contagem, toggle Recentes/Antigos e expansão.
// Removidos do padrão (fora da spec): fundos, stage-age, viewMode de pipelines,
// somas R$ e link de rota de detalhe. No lugar da soma: "próx. follow-up: DD mmm".
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  AlertCircle, ArrowUpDown, CalendarClock, Ellipsis, Filter, GripVertical,
  Loader2, Maximize2, Paperclip, Plus, StickyNote, Target, User, X,
} from 'lucide-react'
import {
  PROSPECCAO_ORIGEM, PROSPECCAO_ORIGEM_LABEL, PROSPECCAO_STATUS, PROSPECCAO_STATUS_LABEL,
  type ProspeccaoStatus,
} from '@/lib/prospeccao'
import {
  PROSPECCOES_QUERY_KEY, useProspeccaoMove, useProspeccoes, type ProspeccaoCard,
} from '@/hooks/useProspeccoes'
import { useProspeccaoAnexoContagem } from '@/hooks/useProspeccaoAnexos'
import { ProspeccaoCreateModal } from '@/components/ProspeccaoCreateModal'
import { ProspeccaoDetalheModal } from '@/components/ProspeccaoDetalheModal'

type OrdenacaoTab = 'recentes' | 'antigos'

type OptionItem = { id: string; nome: string }

function parseMomento(card: Pick<ProspeccaoCard, 'updated_at' | 'created_at'>) {
  const valor = Date.parse(card.updated_at || card.created_at)
  return Number.isFinite(valor) ? valor : 0
}

function sortCards(cards: ProspeccaoCard[], ordem: OrdenacaoTab) {
  const sorted = [...cards]
  sorted.sort((a, b) => {
    const diff = parseMomento(b) - parseMomento(a)
    return ordem === 'recentes' ? diff : -diff
  })
  return sorted
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?'
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function formatDiaMes(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

type FollowUpBadge = { tone: 'danger' | 'gold' | 'silver'; label: string }

// Badge de follow-up do card (spec): vencido=danger / hoje=gold / futuro=silver / ausente=nada.
function followUpBadge(iso: string | null, agora: Date = new Date()): FollowUpBadge | null {
  if (!iso) return null
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  const diffDias = Math.round((startOfDay(data).getTime() - startOfDay(agora).getTime()) / 86_400_000)
  if (diffDias < 0) {
    const dias = -diffDias
    return { tone: 'danger', label: `Follow-up vencido há ${dias} ${dias === 1 ? 'dia' : 'dias'}` }
  }
  if (diffDias === 0) return { tone: 'gold', label: 'Follow-up hoje' }
  return { tone: 'silver', label: `Follow-up em ${formatDiaMes(data)}` }
}

// Menor proxima_acao_em futuro da coluna → "próx. follow-up: DD mmm" no header.
function proximoFollowUp(cards: ProspeccaoCard[], agora: number = Date.now()): Date | null {
  const futuros = cards
    .map(c => (c.proxima_acao_em ? Date.parse(c.proxima_acao_em) : NaN))
    .filter(t => Number.isFinite(t) && t > agora)
  if (futuros.length === 0) return null
  return new Date(Math.min(...futuros))
}

export function ProspeccaoKanban() {
  const qc = useQueryClient()
  const [activeCard, setActiveCard] = useState<ProspeccaoCard | null>(null)
  const [busca, setBusca] = useState('')
  const [responsavelFiltro, setResponsavelFiltro] = useState('')
  const [origemFiltro, setOrigemFiltro] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [expandedStatus, setExpandedStatus] = useState<ProspeccaoStatus | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  // Snapshot do card na abertura: se um refetch remover/atualizar o card, o modal
  // (e um eventual rascunho) não desmonta abruptamente (padrão PropostaObservacoesModal).
  const [detalheCard, setDetalheCard] = useState<ProspeccaoCard | null>(null)
  const [ordenacaoPorStatus, setOrdenacaoPorStatus] = useState<Record<ProspeccaoStatus, OrdenacaoTab>>(() => (
    Object.fromEntries(PROSPECCAO_STATUS.map(status => [status, 'recentes'])) as Record<ProspeccaoStatus, OrdenacaoTab>
  ))
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const boardScrollRef = useRef<HTMLDivElement | null>(null)
  const syncingScrollRef = useRef(false)
  const panningRef = useRef(false)
  const panStartXRef = useRef(0)
  const panStartScrollLeftRef = useRef(0)
  const panPointerIdRef = useRef<number | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const { data: prospeccoes = [], isLoading, error } = useProspeccoes()
  const moveMut = useProspeccaoMove()
  const prospeccaoIds = useMemo(() => prospeccoes.map(row => row.id), [prospeccoes])
  const { data: anexosContagem = {} } = useProspeccaoAnexoContagem(prospeccaoIds)

  const responsaveisDisponiveis = useMemo<OptionItem[]>(() => {
    const seen = new Map<string, string>()
    for (const row of prospeccoes) {
      if (!row.responsavel_id || !row.responsavel_nome || seen.has(row.responsavel_id)) continue
      seen.set(row.responsavel_id, row.responsavel_nome)
    }
    return [...seen.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [prospeccoes])

  const filtrosAtivos = useMemo(() => {
    const labels: string[] = []
    if (responsavelFiltro) {
      const resp = responsaveisDisponiveis.find(item => item.id === responsavelFiltro)
      labels.push(`Responsável: ${resp?.nome ?? 'selecionado'}`)
    }
    if (origemFiltro) {
      labels.push(`Origem: ${PROSPECCAO_ORIGEM_LABEL[origemFiltro as keyof typeof PROSPECCAO_ORIGEM_LABEL] ?? 'selecionada'}`)
    }
    return labels
  }, [responsavelFiltro, origemFiltro, responsaveisDisponiveis])

  const filtradas = useMemo(() => prospeccoes.filter(card => {
    if (responsavelFiltro && card.responsavel_id !== responsavelFiltro) return false
    if (origemFiltro && card.origem !== origemFiltro) return false
    const term = busca.trim().toLowerCase()
    return !term || [card.nome_empresa, card.contato_nome, card.contato_email, card.contato_telefone, card.responsavel_nome]
      .filter(Boolean).join(' ').toLowerCase().includes(term)
  }), [busca, prospeccoes, responsavelFiltro, origemFiltro])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(PROSPECCAO_STATUS.map(status => [status, [] as ProspeccaoCard[]])) as Record<ProspeccaoStatus, ProspeccaoCard[]>
    for (const card of filtradas) {
      if (map[card.status]) map[card.status].push(card)
    }
    for (const status of PROSPECCAO_STATUS) {
      map[status] = sortCards(map[status], ordenacaoPorStatus[status])
    }
    return map
  }, [filtradas, ordenacaoPorStatus])

  const expandedCards = expandedStatus ? byStatus[expandedStatus] : []

  const totalColunas = PROSPECCAO_STATUS.length
  const larguraConteudo = totalColunas * 288 + Math.max(0, totalColunas - 1) * 16


  function onToggleOrdenacao(status: ProspeccaoStatus) {
    setOrdenacaoPorStatus(prev => ({
      ...prev,
      [status]: prev[status] === 'recentes' ? 'antigos' : 'recentes',
    }))
  }

  function onSyncScroll(origem: 'topo' | 'board') {
    if (syncingScrollRef.current) return
    syncingScrollRef.current = true
    const source = origem === 'topo' ? topScrollRef.current : boardScrollRef.current
    const target = origem === 'topo' ? boardScrollRef.current : topScrollRef.current
    if (source && target) target.scrollLeft = source.scrollLeft
    requestAnimationFrame(() => { syncingScrollRef.current = false })
  }

  function limparFiltros() {
    setBusca('')
    setResponsavelFiltro('')
    setOrigemFiltro('')
  }

  function shouldStartBoardPan(target: EventTarget | null) {
    const el = target instanceof HTMLElement ? target : null
    if (!el) return false
    if (el.closest('[data-kanban-card="true"]')) return false
    if (el.closest('[data-no-kanban-pan="true"]')) return false
    if (el.closest('button,a,input,select,textarea,label,[role="button"]')) return false
    return true
  }

  function finishBoardPan() {
    const board = boardScrollRef.current
    if (board && panPointerIdRef.current !== null) {
      try {
        if (board.hasPointerCapture(panPointerIdRef.current)) {
          board.releasePointerCapture(panPointerIdRef.current)
        }
      } catch {
        // no-op: capture pode já ter sido liberado.
      }
    }
    panPointerIdRef.current = null
    panningRef.current = false
    setIsPanning(false)
  }

  function onBoardPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (!shouldStartBoardPan(event.target)) return
    const board = boardScrollRef.current
    if (!board) return
    panningRef.current = true
    panPointerIdRef.current = event.pointerId
    panStartXRef.current = event.clientX
    panStartScrollLeftRef.current = board.scrollLeft
    setIsPanning(true)
    board.setPointerCapture(event.pointerId)
  }

  function onBoardPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!panningRef.current) return
    const board = boardScrollRef.current
    if (!board) return
    const deltaX = event.clientX - panStartXRef.current
    board.scrollLeft = panStartScrollLeftRef.current - deltaX
    event.preventDefault()
  }

  useEffect(() => {
    if (topScrollRef.current && boardScrollRef.current) {
      topScrollRef.current.scrollLeft = boardScrollRef.current.scrollLeft
    }
  }, [totalColunas])

  // Move otimista: cache atualizado na hora; rollback + banner no conflito (40001
  // já vem mapeado pela camada de dados: "Outro membro da equipe moveu este card…").
  function moverPara(card: ProspeccaoCard, novoStatus: ProspeccaoStatus) {
    if (card.status === novoStatus || moveMut.isPending) return
    const previous = qc.getQueryData<ProspeccaoCard[]>(PROSPECCOES_QUERY_KEY) ?? []
    setFeedback(null)
    setSucesso(null)
    qc.setQueryData<ProspeccaoCard[]>(PROSPECCOES_QUERY_KEY, old => (old ?? []).map(item =>
      item.id === card.id ? { ...item, status: novoStatus, updated_at: new Date().toISOString() } : item))
    moveMut.mutate(
      { id: card.id, novoStatus, statusEsperado: card.status },
      {
        onError: (err) => {
          qc.setQueryData(PROSPECCOES_QUERY_KEY, previous)
          setFeedback(err.message)
        },
        onSuccess: () => {
          setSucesso(`"${card.nome_empresa}" movido para ${PROSPECCAO_STATUS_LABEL[novoStatus]}.`)
        },
      },
    )
  }

  function onDragStart(event: DragStartEvent) {
    setActiveCard(prospeccoes.find(card => card.id === String(event.active.id)) ?? null)
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    if (!event.over) return
    const card = prospeccoes.find(item => item.id === String(event.active.id))
    if (card) moverPara(card, String(event.over.id) as ProspeccaoStatus)
  }

  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Prospecção de parceiros</h1>
        <p className="text-sm text-silver-600">Funil comercial de originação — do primeiro contato à conversão em proposta.</p>
      </div>
      <button type="button" className="btn-gold" onClick={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nova oportunidade
      </button>
    </div>

    <div className="card mb-4 grid gap-3 p-4 md:grid-cols-[1fr_auto]">
      <label className="block">
        <span className="sr-only">Buscar oportunidade</span>
        <input
          className="input"
          placeholder="Buscar por empresa, contato, e-mail, telefone ou responsável"
          value={busca}
          onChange={event => setBusca(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-no-liquid btn-outline h-9 px-3 py-0 text-xs" onClick={() => setFiltrosOpen(true)} data-no-kanban-pan="true">
          <Filter className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Filtros
          {filtrosAtivos.length > 0 && <span className="ml-2 rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] text-white">{filtrosAtivos.length}</span>}
        </button>
      </div>
    </div>

    {filtrosAtivos.length > 0 && (
      <div className="mb-4 flex flex-wrap gap-2">
        {filtrosAtivos.map(label => <span key={label} className="rounded-full border border-silver-200 bg-white px-2 py-1 text-[11px] text-silver-700">{label}</span>)}
      </div>
    )}

    <ProspeccaoFiltrosModal
      open={filtrosOpen}
      responsavelFiltro={responsavelFiltro}
      onResponsavelFiltroChange={setResponsavelFiltro}
      responsaveisDisponiveis={responsaveisDisponiveis}
      origemFiltro={origemFiltro}
      onOrigemFiltroChange={setOrigemFiltro}
      onClose={() => setFiltrosOpen(false)}
      onClear={() => { setResponsavelFiltro(''); setOrigemFiltro('') }}
    />

    {(feedback || error) && (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {feedback ?? (error as Error | null)?.message}
      </div>
    )}
    {sucesso && (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success" aria-live="polite">
        {sucesso}
      </div>
    )}

    {isLoading ? (
      <div className="flex items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-silver-500" aria-hidden="true" /><span className="sr-only">Carregando funil…</span></div>
    ) : prospeccoes.length === 0 ? (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <Target className="h-10 w-10 text-silver-300" aria-hidden="true" />
        <h2 className="text-lg font-bold text-slate-950">Nenhuma oportunidade ainda</h2>
        <p className="max-w-md text-sm text-silver-600">Crie o primeiro card do funil para acompanhar a prospecção de parceiros.</p>
        <button type="button" className="btn-gold" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova oportunidade
        </button>
      </div>
    ) : filtradas.length === 0 ? (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-sm font-semibold text-slate-950">Nenhuma oportunidade neste filtro.</p>
        <button type="button" className="btn-no-liquid btn-outline" onClick={limparFiltros}>Limpar</button>
      </div>
    ) : (
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div ref={topScrollRef} onScroll={() => onSyncScroll('topo')} className="mb-2 overflow-x-auto overflow-y-hidden rounded-md border border-silver-200 bg-white" aria-hidden="true">
          <div style={{ width: larguraConteudo, height: 12 }} />
        </div>
        <div
          ref={boardScrollRef}
          onScroll={() => onSyncScroll('board')}
          onPointerDown={onBoardPointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={finishBoardPan}
          onPointerCancel={finishBoardPan}
          onPointerLeave={finishBoardPan}
          className={`flex gap-4 overflow-x-auto pb-4 ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        >
          {PROSPECCAO_STATUS.map(status => (
            <Column
              key={status}
              status={status}
              cards={byStatus[status]}
              order={ordenacaoPorStatus[status]}
              onToggleOrder={onToggleOrdenacao}
              onExpand={() => setExpandedStatus(status)}
              anexosContagem={anexosContagem}
              onOpen={setDetalheCard}
              onMove={moverPara}
            />
          ))}
        </div>
        <DragOverlay>{activeCard ? <ProspeccaoCardView card={activeCard} anexos={anexosContagem[activeCard.id] ?? 0} onOpen={() => {}} onMove={() => {}} dragging /> : null}</DragOverlay>
      </DndContext>
    )}

    {expandedStatus && (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-4 md:p-8" onClick={() => setExpandedStatus(null)}>
        <div className="w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 border-b border-silver-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Coluna expandida</p>
              <h2 className="text-lg font-bold text-slate-950">{PROSPECCAO_STATUS_LABEL[expandedStatus]} ({expandedCards.length})</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onToggleOrdenacao(expandedStatus)} className="btn-no-liquid inline-flex items-center gap-1 rounded-md border border-silver-200 px-2.5 py-1.5 text-xs font-semibold text-silver-700 hover:bg-silver-50" data-no-kanban-pan="true">
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                {ordenacaoPorStatus[expandedStatus] === 'recentes' ? 'Mais recentes' : 'Mais antigos'}
              </button>
              <button type="button" onClick={() => setExpandedStatus(null)} className="btn-no-liquid inline-flex items-center gap-1 rounded-md border border-silver-200 px-2.5 py-1.5 text-xs font-semibold text-silver-700 hover:bg-silver-50" data-no-kanban-pan="true">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Fechar
              </button>
            </div>
          </div>
          <div className="max-h-[72vh] overflow-y-auto p-4">
            {expandedCards.length === 0 ? <p className="text-sm text-silver-500">Sem cards — arraste uma oportunidade para cá.</p>
              : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{expandedCards.map(card => <ProspeccaoCardView key={card.id} card={card} anexos={anexosContagem[card.id] ?? 0} onOpen={() => { setExpandedStatus(null); setDetalheCard(card) }} onMove={moverPara} />)}</div>}
          </div>
        </div>
      </div>
    )}

    {detalheCard && (
      <ProspeccaoDetalheModal
        key={detalheCard.id}
        card={detalheCard}
        onClose={() => setDetalheCard(null)}
      />
    )}

    {createOpen && (
      <ProspeccaoCreateModal
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          setFeedback(null)
          setSucesso('Oportunidade criada em Oportunidades.')
        }}
      />
    )}
  </>
}

function Column({
  status,
  cards,
  order,
  onToggleOrder,
  onExpand,
  anexosContagem,
  onOpen,
  onMove,
}: {
  status: ProspeccaoStatus
  cards: ProspeccaoCard[]
  order: OrdenacaoTab
  onToggleOrder: (status: ProspeccaoStatus) => void
  onExpand: () => void
  anexosContagem: Record<string, number>
  onOpen: (card: ProspeccaoCard) => void
  onMove: (card: ProspeccaoCard, status: ProspeccaoStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const prox = proximoFollowUp(cards)
  return (
    <div className="w-72 shrink-0">
      <div className="rounded-t-md bg-slate-950 p-3 text-white">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn-no-liquid truncate text-left text-sm font-semibold hover:text-gold" onClick={onExpand} title="Expandir etapa" data-no-kanban-pan="true">{PROSPECCAO_STATUS_LABEL[status]}</button>
          <span className="rounded bg-white/15 px-2 py-0.5 text-xs">{cards.length}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="whitespace-nowrap text-xs text-white/70">{prox ? `próx. follow-up: ${formatDiaMes(prox)}` : 'próx. follow-up: —'}</p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onToggleOrder(status)} className="btn-no-liquid inline-flex items-center gap-1 rounded border border-white/20 px-1.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/10" title="Alternar ordenação da coluna" data-no-kanban-pan="true"><ArrowUpDown className="h-3 w-3" aria-hidden="true" />{order === 'recentes' ? 'Recentes' : 'Antigos'}</button>
            <button type="button" onClick={onExpand} className="btn-no-liquid inline-flex items-center gap-1 rounded border border-white/20 px-1.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/10" title="Expandir etapa" data-no-kanban-pan="true"><Maximize2 className="h-3 w-3" aria-hidden="true" />Expandir</button>
          </div>
        </div>
      </div>
      <div ref={setNodeRef} className={`min-h-[240px] space-y-2 rounded-b-md p-2 ${isOver ? 'bg-gold/10' : 'bg-silver-100'}`}>
        {cards.length === 0 && <p className="px-2 py-8 text-center text-xs text-silver-500">Sem cards — arraste uma oportunidade para cá.</p>}
        {cards.map(card => <DraggableCard key={card.id} card={card} anexos={anexosContagem[card.id] ?? 0} onOpen={onOpen} onMove={onMove} />)}
      </div>
    </div>
  )
}

function DraggableCard({ card, anexos, onOpen, onMove }: { card: ProspeccaoCard; anexos: number; onOpen: (card: ProspeccaoCard) => void; onMove: (card: ProspeccaoCard, status: ProspeccaoStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? 'opacity-40' : ''} data-kanban-card="true"><ProspeccaoCardView card={card} anexos={anexos} onOpen={onOpen} onMove={onMove} /></div>
}

// Card do funil (spec #34): empresa (clamp 2), contato, chip de origem + avatar do
// responsável, badge de follow-up e rodapé com notas/anexos. Clique abre o detalhe;
// o menu "…" (data-no-kanban-pan) é o caminho de teclado para mover (a11y).
function ProspeccaoCardView({ card, anexos, dragging, onOpen, onMove }: { card: ProspeccaoCard; anexos: number; dragging?: boolean; onOpen: (card: ProspeccaoCard) => void; onMove: (card: ProspeccaoCard, status: ProspeccaoStatus) => void }) {
  const badge = followUpBadge(card.proxima_acao_em)
  return (
    <div
      className={`card relative overflow-hidden ${dragging ? 'rotate-1 shadow-xl' : 'cursor-grab active:cursor-grabbing'}`}
      onClick={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest('button,a,[data-no-kanban-pan="true"]')) return
        onOpen(card)
      }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-silver-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <button
                type="button"
                onClick={() => onOpen(card)}
                onPointerDown={event => event.stopPropagation()}
                className="btn-no-liquid line-clamp-2 rounded p-0 text-left text-sm font-semibold text-silver-900 hover:text-navy"
                aria-label={`Detalhes de ${card.nome_empresa}`}
                data-no-kanban-pan="true"
              >
                {card.nome_empresa}
              </button>
              <CardMenu card={card} onMove={onMove} />
            </div>
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-silver-600">
              <User className="h-3 w-3 shrink-0" aria-hidden="true" />
              {card.contato_nome}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full border border-silver-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-silver-700">{PROSPECCAO_ORIGEM_LABEL[card.origem]}</span>
              {card.responsavel_nome ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white" title={card.responsavel_nome} role="img" aria-label={`Responsável: ${card.responsavel_nome}`}>{iniciais(card.responsavel_nome)}</span>
              ) : (
                <span className="text-[10px] text-silver-500">Sem responsável</span>
              )}
            </div>
            {badge && (
              <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                badge.tone === 'danger' ? 'bg-danger/10 text-danger'
                  : badge.tone === 'gold' ? 'bg-gold/20 text-navy'
                    : 'bg-silver-100 text-silver-600'
              }`}>
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                {badge.label}
              </p>
            )}
          </div>
        </div>
      </div>
      {(card.notas || anexos > 0) && (
        <div className="flex items-center justify-end gap-3 border-t border-silver-100 bg-silver-50 px-3 py-2 text-[11px] font-semibold text-silver-600">
          {card.notas && <span className="inline-flex items-center" title="Tem observações" role="img" aria-label="Tem observações"><StickyNote className="h-3.5 w-3.5" aria-hidden="true" /></span>}
          {anexos > 0 && <span className="inline-flex items-center gap-1" role="img" aria-label={`${anexos} ${anexos === 1 ? 'anexo' : 'anexos'}`}><Paperclip className="h-3.5 w-3.5" aria-hidden="true" />{anexos}</span>}
        </div>
      )}
    </div>
  )
}

// Menu "Mover para…" — caminho de teclado obrigatório para mover sem drag (a11y).
function CardMenu({ card, onMove }: { card: ProspeccaoCard; onMove: (card: ProspeccaoCard, status: ProspeccaoStatus) => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
    }, 0)
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative shrink-0" onPointerDown={event => event.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Ações de ${card.nome_empresa}`}
        data-no-kanban-pan="true"
        onClick={() => setOpen(v => !v)}
        className="btn-no-liquid rounded-md p-1 text-silver-500 hover:bg-silver-100 hover:text-silver-700"
      >
        <Ellipsis className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" aria-hidden="true" onClick={() => setOpen(false)} />
          <div ref={menuRef} id={menuId} role="menu" aria-label={`Mover ${card.nome_empresa} para outra etapa`} className="absolute right-0 z-50 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-silver-200 bg-white p-1 shadow-lg">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-silver-400">Mover para…</p>
            {PROSPECCAO_STATUS.map(s => (
              <button
                key={s}
                type="button"
                role="menuitem"
                disabled={s === card.status}
                data-no-kanban-pan="true"
                className="btn-no-liquid flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-silver-700 hover:bg-silver-50 disabled:opacity-40"
                onClick={() => { setOpen(false); onMove(card, s) }}
              >
                <span>{PROSPECCAO_STATUS_LABEL[s]}</span>
                {s === card.status && <span className="text-[9px] font-semibold uppercase text-silver-400">atual</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProspeccaoFiltrosModal({
  open,
  responsavelFiltro,
  onResponsavelFiltroChange,
  responsaveisDisponiveis,
  origemFiltro,
  onOrigemFiltroChange,
  onClose,
  onClear,
}: {
  open: boolean
  responsavelFiltro: string
  onResponsavelFiltroChange: (value: string) => void
  responsaveisDisponiveis: OptionItem[]
  origemFiltro: string
  onOrigemFiltroChange: (value: string) => void
  onClose: () => void
  onClear: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Filtros do funil</h2>
            <p className="text-xs text-silver-600">Aplique filtros por responsável e origem.</p>
          </div>
          <button type="button" className="btn-no-liquid rounded-md border border-silver-200 p-1.5 text-silver-600 hover:bg-silver-50" onClick={onClose} aria-label="Fechar filtros" data-no-kanban-pan="true">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-silver-500" htmlFor="prospeccao-filtro-responsavel">Responsável</label>
            <select id="prospeccao-filtro-responsavel" className="input h-10 py-0 text-sm" value={responsavelFiltro} onChange={event => onResponsavelFiltroChange(event.target.value)}>
              <option value="">Todos os responsáveis</option>
              {responsaveisDisponiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-silver-500" htmlFor="prospeccao-filtro-origem">Origem</label>
            <select id="prospeccao-filtro-origem" className="input h-10 py-0 text-sm" value={origemFiltro} onChange={event => onOrigemFiltroChange(event.target.value)}>
              <option value="">Todas as origens</option>
              {PROSPECCAO_ORIGEM.map(origem => <option key={origem} value={origem}>{PROSPECCAO_ORIGEM_LABEL[origem]}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" className="btn-no-liquid btn-outline" onClick={onClear} data-no-kanban-pan="true">Limpar</button>
          <button type="button" className="btn-no-liquid btn" onClick={onClose} data-no-kanban-pan="true">Aplicar</button>
        </div>
      </div>
    </div>
  )
}

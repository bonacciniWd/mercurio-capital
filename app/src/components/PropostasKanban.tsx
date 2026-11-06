import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { AlertCircle, ArrowUpDown, Filter, GripVertical, Loader2, Maximize2, TriangleAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { incluiStatusNaVisaoKanban, PRODUTO_LABEL, PROPOSTA_KANBAN_STATUS, PROPOSTA_STATUS_LABEL, toKanbanStatus, type KanbanViewMode, type PropostaKanbanStatus } from '@/lib/propostaStatus'
import { getProposalStageAge, isProposalStageAgeEligible } from '@/lib/propostaStageAge'
import { FUNDO_STATUS, FUNDO_STATUS_COLOR, FUNDO_STATUS_LABEL, type FundoStatus } from '@/lib/fundoStatus'
import { invalidateAdminDashboardQueries } from '@/lib/adminDashboardCache'
import { useAuth } from '@/auth/AuthContext'

type KanbanScope = 'admin' | 'partner'
type OrdenacaoTab = 'recentes' | 'antigos'

type OptionItem = {
  id: string
  nome: string
}

interface KanbanCard {
  id: string; protocolo: string | null; produto: string; status: string
  valor_solicitado: number; valor_imoveis_total: number
  created_at: string; updated_at: string; partner_id: string | null
  partner_nome: string | null
  responsavel_id: string | null
  responsavel_nome: string | null
  cliente_id: string | null
  cliente_nome: string | null
}

interface CardFundo {
  fundo_id: string
  nome: string
  cor_hex: string
  status_fundo: FundoStatus
}

type FundosPorProposta = Record<string, CardFundo[]>
type FundoStatusHandler = (propostaId: string, fundoId: string, status: FundoStatus) => void
interface FundWinnerProjection { proposta_id: string; fundo_id: string; nome: string; cor_hex: string; aprovado_em: string }

function diasDesde(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function labelViewMode(mode: KanbanViewMode) {
  if (mode === 'todos') return 'Todos'
  if (mode === 'operacional') return 'Operacional'
  if (mode === 'standby') return 'Standby'
  if (mode === 'rascunhos') return 'Rascunhos'
  return 'Canceladas'
}

function parseMomento(card: Pick<KanbanCard, 'updated_at' | 'created_at'>) {
  const valor = Date.parse(card.updated_at || card.created_at)
  return Number.isFinite(valor) ? valor : 0
}

function sortCards(cards: KanbanCard[], ordem: OrdenacaoTab) {
  const sorted = [...cards]
  sorted.sort((a, b) => {
    const diff = parseMomento(b) - parseMomento(a)
    return ordem === 'recentes' ? diff : -diff
  })
  return sorted
}

function formatKanbanTotalCompact(totalCentavos: number) {
  const valor = totalCentavos / 100
  if (!Number.isFinite(valor) || valor <= 0) return 'R$ 0,00'

  if (valor >= 1_000_000_000) {
    return `R$ ${(valor / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi`
  }
  if (valor >= 1_000_000) {
    return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
  }
  if (valor >= 1_000) {
    return `R$ ${(valor / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return brl(totalCentavos)
}

export function PropostasKanban({ scope }: { scope: KanbanScope }) {
  const { session } = useAuth()
  const canViewStageAlerts = scope === 'admin' && session?.role === 'admin'
    && (session.adminNivel === 'full' || session.adminNivel === 'limitado')
  const qc = useQueryClient()
  const queryKey = useMemo(() => (scope === 'admin'
    ? (['admin-kanban-propostas'] as const)
    : (['partner-kanban-propostas'] as const)), [scope])
  const listRpc = scope === 'admin' ? 'admin_list_propostas' : 'partner_list_kanban_propostas'
  const statusRpc = scope === 'admin' ? 'admin_set_proposta_status' : 'partner_set_proposta_status'
  const detailBase = scope === 'admin' ? '/admin/propostas' : '/p/propostas'
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null)
  const [busca, setBusca] = useState('')
  const [viewMode, setViewMode] = useState<KanbanViewMode>('operacional')
  const [operacaoFiltro, setOperacaoFiltro] = useState('')
  const [responsavelFiltro, setResponsavelFiltro] = useState('')
  const [fundoFiltro, setFundoFiltro] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [expandedStatus, setExpandedStatus] = useState<PropostaKanbanStatus | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [ordenacaoPorStatus, setOrdenacaoPorStatus] = useState<Record<PropostaKanbanStatus, OrdenacaoTab>>(() => (
    Object.fromEntries(PROPOSTA_KANBAN_STATUS.map(status => [status, 'recentes'])) as Record<PropostaKanbanStatus, OrdenacaoTab>
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

  const proposalIds = useMemo(() => propostas.map(row => row.id), [propostas])
  const stageAgesKey = useMemo(() => ['admin-kanban-stage-ages', proposalIds.join(',')] as const, [proposalIds])
  const { data: stageEntries = [] } = useQuery({
    queryKey: stageAgesKey,
    enabled: canViewStageAlerts && proposalIds.length > 0,
    refetchInterval: 45_000,
    queryFn: async (): Promise<{ proposta_id: string; status: string; entrou_em: string }[]> => {
      const { data, error } = await supabase.rpc('admin_kanban_etapa_inicio', { p_proposta_ids: proposalIds })
      if (error) throw error
      return (data ?? []) as { proposta_id: string; status: string; entrou_em: string }[]
    },
  })
  const stageEntryByProposal = useMemo(() => {
    const currentStatusByProposal = new Map(propostas.map(card => [card.id, card.status]))
    return new Map(stageEntries
      .filter(row => currentStatusByProposal.get(row.proposta_id) === row.status)
      .map(row => [row.proposta_id, row]))
  }, [propostas, stageEntries])
  const stageStartedAtFor = (card: KanbanCard) => {
    const entry = stageEntryByProposal.get(card.id)
    return entry?.status === card.status ? entry.entrou_em : undefined
  }

  const { data: winnerRows = [], error: winnerProjectionError } = useQuery({
    queryKey: ['admin-kanban-fundos-vencedores', proposalIds.join(',')],
    enabled: scope === 'admin' && proposalIds.length > 0,
    queryFn: async (): Promise<FundWinnerProjection[]> => {
      const { data, error } = await supabase.rpc('admin_proposta_fundos_vencedores', { p_proposta_ids: proposalIds })
      if (error) throw error
      return (data ?? []) as FundWinnerProjection[]
    },
  })
  const winnerByProposal = useMemo(() => new Map(winnerRows.map(row => [row.proposta_id, row])), [winnerRows])

  useEffect(() => {
    const channel = supabase.channel(`${scope}-kanban`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propostas' }, () => {
        void qc.invalidateQueries({ queryKey })
        void qc.invalidateQueries({ queryKey: ['admin-kanban-stage-ages'] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [qc, queryKey, scope])

  // Fundos (apenas admin — RLS restringe a leitura ao interno).
  const { data: fundosRows = [] } = useQuery({
    queryKey: ['admin-kanban-fundos'],
    enabled: scope === 'admin',
    refetchInterval: 45_000,
    queryFn: async (): Promise<{ proposta_id: string; status_fundo: FundoStatus; fundos: { id: string; nome: string; cor_hex: string } | null }[]> => {
      const { data, error } = await supabase
        .from('proposta_fundos')
        .select('proposta_id, status_fundo, fundos(id, nome, cor_hex)')
      if (error) throw error
      return (data ?? []) as unknown as { proposta_id: string; status_fundo: FundoStatus; fundos: { id: string; nome: string; cor_hex: string } | null }[]
    },
  })

  const fundosByProposta = useMemo<FundosPorProposta>(() => {
    const map: FundosPorProposta = {}
    for (const row of fundosRows) {
      if (!row.fundos) continue
      const list = map[row.proposta_id] ?? (map[row.proposta_id] = [])
      list.push({ fundo_id: row.fundos.id, nome: row.fundos.nome, cor_hex: row.fundos.cor_hex, status_fundo: row.status_fundo })
    }
    return map
  }, [fundosRows])

  const fundosDisponiveis = useMemo(() => {
    const seen = new Map<string, { id: string; nome: string; cor_hex: string }>()
    for (const row of fundosRows) {
      if (row.fundos && !seen.has(row.fundos.id)) seen.set(row.fundos.id, row.fundos)
    }
    return [...seen.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [fundosRows])

  const operacoesDisponiveis = useMemo<OptionItem[]>(() => {
    const seen = new Map<string, string>()
    for (const row of propostas) {
      if (!row.partner_id || !row.partner_nome || seen.has(row.partner_id)) continue
      seen.set(row.partner_id, row.partner_nome)
    }
    return [...seen.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [propostas])

  const responsaveisDisponiveis = useMemo<OptionItem[]>(() => {
    if (scope !== 'admin') return []
    const seen = new Map<string, string>()
    for (const row of propostas) {
      if (!row.responsavel_id || !row.responsavel_nome || seen.has(row.responsavel_id)) continue
      seen.set(row.responsavel_id, row.responsavel_nome)
    }
    return [...seen.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [propostas, scope])

  async function setFundoStatus(propostaId: string, fundoId: string, status: FundoStatus) {
    setFeedback(null)
    const { error } = await supabase.rpc('admin_proposta_fundo_set', {
      p_proposta_id: propostaId, p_fundo_id: fundoId, p_status: status, p_obs: null,
    })
    if (error) { setFeedback(`Falha ao atualizar fundo: ${error.message}`); return }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-kanban-fundos'] }),
      qc.invalidateQueries({ queryKey: ['admin-kanban-fundos-vencedores'] }),
      invalidateAdminDashboardQueries(qc),
    ])
  }

  const filtrosAtivos = useMemo(() => {
    const labels: string[] = []
    if (viewMode !== 'operacional') labels.push(`Pipeline: ${labelViewMode(viewMode)}`)
    if (operacaoFiltro) {
      const op = operacoesDisponiveis.find(item => item.id === operacaoFiltro)
      labels.push(`Operação: ${op?.nome ?? 'selecionada'}`)
    }
    if (scope === 'admin' && responsavelFiltro) {
      const resp = responsaveisDisponiveis.find(item => item.id === responsavelFiltro)
      labels.push(`Responsável: ${resp?.nome ?? 'selecionado'}`)
    }
    if (scope === 'admin' && fundoFiltro) {
      const fundo = fundosDisponiveis.find(item => item.id === fundoFiltro)
      labels.push(`Fundo: ${fundo?.nome ?? 'selecionado'}`)
    }
    return labels
  }, [viewMode, operacaoFiltro, scope, responsavelFiltro, fundoFiltro, operacoesDisponiveis, responsaveisDisponiveis, fundosDisponiveis])

  const filtradas = useMemo(() => propostas.filter(card => {
    if (!incluiStatusNaVisaoKanban(card.status, viewMode)) return false
    if (operacaoFiltro && card.partner_id !== operacaoFiltro) return false
    if (scope === 'admin' && responsavelFiltro && card.responsavel_id !== responsavelFiltro) return false
    if (scope === 'admin' && fundoFiltro) {
      const fs = fundosByProposta[card.id] ?? []
      if (!fs.some(f => f.fundo_id === fundoFiltro)) return false
    }
    const term = busca.trim().toLowerCase()
    return !term || [card.protocolo, card.cliente_nome, card.partner_nome, card.responsavel_nome, card.produto]
      .filter(Boolean).join(' ').toLowerCase().includes(term)
  }), [busca, propostas, viewMode, operacaoFiltro, scope, responsavelFiltro, fundoFiltro, fundosByProposta])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(PROPOSTA_KANBAN_STATUS.map(status => [status, [] as KanbanCard[]])) as Record<PropostaKanbanStatus, KanbanCard[]>
    let naoMapeadas: KanbanCard[] = []
    for (const card of filtradas) {
      const mapped = toKanbanStatus(card.status)
      if (mapped) map[mapped].push(card); else naoMapeadas.push(card)
    }
    for (const status of PROPOSTA_KANBAN_STATUS) {
      map[status] = sortCards(map[status], ordenacaoPorStatus[status])
    }
    naoMapeadas = sortCards(naoMapeadas, 'recentes')
    return { map, naoMapeadas }
  }, [filtradas, ordenacaoPorStatus])

  const expandedCards = expandedStatus ? byStatus.map[expandedStatus] : []

  const totalColunas = PROPOSTA_KANBAN_STATUS.length + (byStatus.naoMapeadas.length > 0 ? 1 : 0)
  const larguraConteudo = totalColunas * 288 + Math.max(0, totalColunas - 1) * 16

  function onToggleOrdenacao(status: PropostaKanbanStatus) {
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
    setViewMode('operacional')
    setOperacaoFiltro('')
    setResponsavelFiltro('')
    setFundoFiltro('')
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
  }, [totalColunas, viewMode])

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
      return
    }
    await qc.invalidateQueries({ queryKey })
    await qc.invalidateQueries({ queryKey: ['admin-kanban-stage-ages'] })
    if (scope === 'admin') await invalidateAdminDashboardQueries(qc)
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
      <div><h1 className="text-2xl font-bold text-slate-950">Kanban de propostas</h1><p className="text-sm text-silver-600">{scope === 'admin' ? 'Pipeline global da operação.' : 'Pipeline restrito às propostas da sua operação.'}</p></div>
      <Link to={detailBase} className="btn-outline">Ver lista</Link>
    </div>
    <div className="card mb-4 grid gap-3 p-4 md:grid-cols-[1fr_auto]">
      <input className="input" placeholder="Buscar por protocolo, cliente, responsável ou operação" value={busca} onChange={event => setBusca(event.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-no-liquid btn-outline h-9 px-3 py-0 text-xs" onClick={() => setFiltrosOpen(true)} data-no-kanban-pan="true">
          <Filter className="mr-1.5 h-3.5 w-3.5" />
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

    <KanbanFiltrosModal
      open={filtrosOpen}
      scope={scope}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      operacaoFiltro={operacaoFiltro}
      onOperacaoFiltroChange={setOperacaoFiltro}
      operacoesDisponiveis={operacoesDisponiveis}
      responsavelFiltro={responsavelFiltro}
      onResponsavelFiltroChange={setResponsavelFiltro}
      responsaveisDisponiveis={responsaveisDisponiveis}
      fundoFiltro={fundoFiltro}
      onFundoFiltroChange={setFundoFiltro}
      fundosDisponiveis={fundosDisponiveis}
      onClose={() => setFiltrosOpen(false)}
      onClear={limparFiltros}
    />

    {(feedback || error || winnerProjectionError) && <div className="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertCircle className="h-4 w-4" />{feedback ?? (error as Error | null)?.message ?? `Não foi possível carregar o fundo vencedor: ${(winnerProjectionError as Error).message}`}</div>}
    {isLoading ? <div className="flex items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>
      : viewMode !== 'operacional' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtradas.map(card => <CardView key={card.id} card={card} scope={scope} detailBase={detailBase} fundos={fundosByProposta[card.id]} winner={winnerByProposal.get(card.id)} onFundoStatus={scope === 'admin' ? setFundoStatus : undefined} stageStartedAt={stageStartedAtFor(card)} showStageAge={canViewStageAlerts} />)}{filtradas.length === 0 && <p className="text-sm text-silver-500">Nenhuma proposta neste filtro.</p>}</div>
      : <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div ref={topScrollRef} onScroll={() => onSyncScroll('topo')} className="mb-2 overflow-x-auto overflow-y-hidden rounded-md border border-silver-200 bg-white">
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
          {PROPOSTA_KANBAN_STATUS.map(status => <Column key={status} status={status} cards={byStatus.map[status]} order={ordenacaoPorStatus[status]} onToggleOrder={onToggleOrdenacao} onExpand={() => setExpandedStatus(status)} scope={scope} detailBase={detailBase} fundosByProposta={fundosByProposta} winnersByProposta={winnerByProposal} onFundoStatus={scope === 'admin' ? setFundoStatus : undefined} stageEntryByProposal={stageEntryByProposal} showStageAge={canViewStageAlerts} />)}
          {byStatus.naoMapeadas.length > 0 && <div className="w-72 shrink-0"><div className="rounded-t-md bg-silver-700 p-3 text-white"><span className="text-sm font-semibold">Legado / Não mapeado</span></div><div className="min-h-[240px] space-y-2 rounded-b-md bg-silver-100 p-2">{byStatus.naoMapeadas.map(card => <CardView key={card.id} card={card} scope={scope} detailBase={detailBase} fundos={fundosByProposta[card.id]} winner={winnerByProposal.get(card.id)} onFundoStatus={scope === 'admin' ? setFundoStatus : undefined} stageStartedAt={stageStartedAtFor(card)} showStageAge={canViewStageAlerts} />)}</div></div>}
        </div>
        <DragOverlay>{activeCard ? <CardView card={activeCard} scope={scope} detailBase={detailBase} fundos={fundosByProposta[activeCard.id]} winner={winnerByProposal.get(activeCard.id)} stageStartedAt={stageStartedAtFor(activeCard)} showStageAge={canViewStageAlerts} dragging /> : null}</DragOverlay>
      </DndContext>}

    {expandedStatus && (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-4 md:p-8" onClick={() => setExpandedStatus(null)}>
        <div className="w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 border-b border-silver-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Tabela expandida</p>
              <h2 className="text-lg font-bold text-slate-950">{PROPOSTA_STATUS_LABEL[expandedStatus]} ({expandedCards.length})</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onToggleOrdenacao(expandedStatus)} className="btn-no-liquid inline-flex items-center gap-1 rounded-md border border-silver-200 px-2.5 py-1.5 text-xs font-semibold text-silver-700 hover:bg-silver-50" data-no-kanban-pan="true">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {ordenacaoPorStatus[expandedStatus] === 'recentes' ? 'Mais recentes' : 'Mais antigos'}
              </button>
              <button type="button" onClick={() => setExpandedStatus(null)} className="btn-no-liquid inline-flex items-center gap-1 rounded-md border border-silver-200 px-2.5 py-1.5 text-xs font-semibold text-silver-700 hover:bg-silver-50" data-no-kanban-pan="true">
                <X className="h-3.5 w-3.5" />
                Fechar
              </button>
            </div>
          </div>
          <div className="max-h-[72vh] overflow-y-auto p-4">
            {expandedCards.length === 0 ? <p className="text-sm text-silver-500">Nenhuma proposta nesta etapa.</p>
              : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{expandedCards.map(card => <CardView key={card.id} card={card} scope={scope} detailBase={detailBase} fundos={fundosByProposta[card.id]} winner={winnerByProposal.get(card.id)} onFundoStatus={scope === 'admin' ? setFundoStatus : undefined} stageStartedAt={stageStartedAtFor(card)} showStageAge={canViewStageAlerts} />)}</div>}
          </div>
        </div>
      </div>
    )}
  </>
}

function Column({
  status,
  cards,
  order,
  onToggleOrder,
  onExpand,
  scope,
  detailBase,
  fundosByProposta,
  winnersByProposta,
  onFundoStatus,
  stageEntryByProposal,
  showStageAge,
}: {
  status: PropostaKanbanStatus
  cards: KanbanCard[]
  order: OrdenacaoTab
  onToggleOrder: (status: PropostaKanbanStatus) => void
  onExpand: () => void
  scope: KanbanScope
  detailBase: string
  fundosByProposta: FundosPorProposta
  winnersByProposta: Map<string, FundWinnerProjection>
  onFundoStatus?: FundoStatusHandler
  stageEntryByProposal: Map<string, { proposta_id: string; status: string; entrou_em: string }>
  showStageAge: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const total = cards.reduce((sum, card) => sum + card.valor_solicitado, 0)
  const totalCentavos = total * 100
  const totalCompacto = formatKanbanTotalCompact(totalCentavos)
  return <div className="w-72 shrink-0"><div className="rounded-t-md bg-slate-950 p-3 text-white"><div className="flex items-center justify-between gap-2"><button type="button" className="btn-no-liquid truncate text-left text-sm font-semibold hover:text-red-200" onClick={onExpand} title="Expandir etapa" data-no-kanban-pan="true">{PROPOSTA_STATUS_LABEL[status]}</button><span className="rounded bg-white/15 px-2 py-0.5 text-xs">{cards.length}</span></div><div className="mt-2 flex items-center justify-between gap-2"><p className="max-w-[104px] truncate whitespace-nowrap text-xs text-white/70" title={brl(totalCentavos)}>{totalCompacto}</p><div className="flex items-center gap-1"><button type="button" onClick={() => onToggleOrder(status)} className="btn-no-liquid inline-flex items-center gap-1 rounded border border-white/20 px-1.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/10" title="Alternar ordenação da coluna" data-no-kanban-pan="true"><ArrowUpDown className="h-3 w-3" />{order === 'recentes' ? 'Recentes' : 'Antigos'}</button><button type="button" onClick={onExpand} className="btn-no-liquid inline-flex items-center gap-1 rounded border border-white/20 px-1.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/10" title="Expandir etapa" data-no-kanban-pan="true"><Maximize2 className="h-3 w-3" />Expandir</button></div></div></div><div ref={setNodeRef} className={`min-h-[240px] space-y-2 rounded-b-md p-2 ${isOver ? 'bg-gold/10' : 'bg-silver-100'}`}>{cards.map(card => <DraggableCard key={card.id} card={card} scope={scope} detailBase={detailBase} fundos={fundosByProposta[card.id]} winner={winnersByProposta.get(card.id)} onFundoStatus={onFundoStatus} stageStartedAt={stageEntryByProposal.get(card.id)?.entrou_em} showStageAge={showStageAge} />)}</div></div>
}

function DraggableCard({ card, scope, detailBase, fundos, winner, onFundoStatus, stageStartedAt, showStageAge }: { card: KanbanCard; scope: KanbanScope; detailBase: string; fundos?: CardFundo[]; winner?: FundWinnerProjection; onFundoStatus?: FundoStatusHandler; stageStartedAt?: string; showStageAge: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? 'opacity-40' : ''} data-kanban-card="true"><CardView card={card} scope={scope} detailBase={detailBase} fundos={fundos} winner={winner} onFundoStatus={onFundoStatus} stageStartedAt={stageStartedAt} showStageAge={showStageAge} /></div>
}

function FundoBadges({ propostaId, fundos, winnerId, onFundoStatus }: { propostaId: string; fundos?: CardFundo[]; winnerId?: string; onFundoStatus?: FundoStatusHandler }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (!fundos || fundos.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1" onPointerDown={event => event.stopPropagation()}>
      {fundos.map(f => (
        <div key={f.fundo_id} className="relative">
          <button
            type="button"
            title={`${f.nome}: ${f.fundo_id === winnerId ? 'fundo vencedor, primeira aprovação' : FUNDO_STATUS_LABEL[f.status_fundo]}`}
            onClick={() => { if (onFundoStatus) setOpenId(openId === f.fundo_id ? null : f.fundo_id) }}
            className="btn-no-liquid inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            data-no-kanban-pan="true"
            style={{ backgroundColor: f.cor_hex }}
          >
            <span className="h-1.5 w-1.5 rounded-full ring-1 ring-white/70" style={{ backgroundColor: FUNDO_STATUS_COLOR[f.status_fundo] }} />
            {f.nome}
            {f.fundo_id === winnerId ? ' · Vencedor' : ''}
          </button>
          {openId === f.fundo_id && onFundoStatus && (
            <div className="absolute z-30 mt-1 w-36 rounded-md border border-silver-200 bg-white p-1 shadow-lg">
              {FUNDO_STATUS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { onFundoStatus(propostaId, f.fundo_id, s); setOpenId(null) }}
                  className="btn-no-liquid flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-silver-50"
                  data-no-kanban-pan="true"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FUNDO_STATUS_COLOR[s] }} />
                  {FUNDO_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function CardView({ card, scope, detailBase, dragging, fundos, winner, onFundoStatus, stageStartedAt, showStageAge = false }: { card: KanbanCard; scope: KanbanScope; detailBase: string; dragging?: boolean; fundos?: CardFundo[]; winner?: FundWinnerProjection; onFundoStatus?: FundoStatusHandler; stageStartedAt?: string; showStageAge?: boolean }) {
  const dias = diasDesde(card.created_at)
  const isLegacy = toKanbanStatus(card.status) !== card.status
  const stageAge = showStageAge && isProposalStageAgeEligible(card.status)
    ? getProposalStageAge(stageStartedAt)
    : null
  const overdue = stageAge?.overdue === true
  return <div className={`card relative overflow-hidden ${overdue ? '!border-2 !border-danger ring-2 ring-danger/20 shadow-[0_0_0_3px_rgba(220,38,38,0.08)]' : ''} ${dragging ? 'rotate-1 shadow-xl' : 'cursor-grab active:cursor-grabbing'}`} aria-label={overdue ? `Proposta parada há ${stageAge?.days ?? 0} dias nesta etapa` : undefined}><div className="p-3">{overdue && <div className="mb-2 flex items-center gap-1.5 rounded-md border border-danger/25 bg-danger/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-danger"><TriangleAlert className="h-3.5 w-3.5" />Parada há mais de 10 dias</div>}<div className="flex items-start gap-2"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-silver-400" /><div className="min-w-0 flex-1"><p className="font-mono text-xs text-silver-500">{card.protocolo || card.id.slice(0, 8)}</p><Link to={`${detailBase}/${card.id}`} onPointerDown={event => event.stopPropagation()} className="mt-1 block truncate text-sm font-semibold text-silver-900 hover:text-red-700">{card.cliente_nome || 'Cliente não informado'}</Link><p className="mt-1 truncate text-xs text-silver-600">{scope === 'admin' ? `Responsável: ${card.responsavel_nome || 'Não atribuído'}` : `Originador: ${card.partner_nome || '—'}`}</p>{scope === 'admin' && <p className="mt-1 truncate text-[11px] text-silver-500">Originador: {card.partner_nome || '—'}</p>}<dl className={`mt-3 grid gap-2 text-xs ${stageAge ? 'grid-cols-2' : 'grid-cols-2'}`}><div><dt className="text-silver-400">Crédito</dt><dd className="font-medium text-silver-700">{brl(card.valor_solicitado * 100)}</dd></div><div><dt className="text-silver-400">Na esteira</dt><dd className="font-medium text-silver-900">{dias} dias</dd></div>{stageAge && <div><dt className="text-silver-400">Nesta etapa</dt><dd className={`flex items-center gap-1 font-semibold ${overdue ? 'text-danger' : 'text-silver-900'}`}>{stageAge.days === null ? '—' : `${stageAge.days} dias`}{overdue && <span className="inline-flex animate-pulse motion-reduce:animate-none items-center gap-1 rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger" title="Proposta há mais de 10 dias nesta etapa"><TriangleAlert className="h-3 w-3" />Atenção</span>}</dd></div>}</dl>{winner && scope === 'admin' && <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-success"><span className="h-2 w-2 rounded-full" style={{backgroundColor:winner.cor_hex}} />Fundo vencedor: {winner.nome}</p>}<FundoBadges propostaId={card.id} fundos={fundos} winnerId={winner?.fundo_id} onFundoStatus={onFundoStatus} />{isLegacy && <p className="mt-2 text-[10px] font-medium text-red-700">{PROPOSTA_STATUS_LABEL[card.status]}</p>}</div></div></div><div className="border-t border-silver-100 bg-silver-50 px-3 py-2 text-[11px] font-semibold text-silver-600">{PRODUTO_LABEL[card.produto] ?? card.produto}</div></div>
}

function KanbanFiltrosModal({
  open,
  scope,
  viewMode,
  onViewModeChange,
  operacaoFiltro,
  onOperacaoFiltroChange,
  operacoesDisponiveis,
  responsavelFiltro,
  onResponsavelFiltroChange,
  responsaveisDisponiveis,
  fundoFiltro,
  onFundoFiltroChange,
  fundosDisponiveis,
  onClose,
  onClear,
}: {
  open: boolean
  scope: KanbanScope
  viewMode: KanbanViewMode
  onViewModeChange: (value: KanbanViewMode) => void
  operacaoFiltro: string
  onOperacaoFiltroChange: (value: string) => void
  operacoesDisponiveis: OptionItem[]
  responsavelFiltro: string
  onResponsavelFiltroChange: (value: string) => void
  responsaveisDisponiveis: OptionItem[]
  fundoFiltro: string
  onFundoFiltroChange: (value: string) => void
  fundosDisponiveis: { id: string; nome: string; cor_hex: string }[]
  onClose: () => void
  onClear: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Filtros do Kanban</h2>
            <p className="text-xs text-silver-600">Aplique filtros por pipeline, operação, responsável e fundos.</p>
          </div>
          <button type="button" className="btn-no-liquid rounded-md border border-silver-200 p-1.5 text-silver-600 hover:bg-silver-50" onClick={onClose} data-no-kanban-pan="true">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-silver-500">Pipeline</p>
            <div className="flex flex-wrap gap-2">
              {(['standby', 'operacional', 'todos', 'rascunhos', 'canceladas'] as KanbanViewMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={`btn-no-liquid rounded-md border px-2.5 py-1.5 text-xs font-medium ${viewMode === mode ? 'border-slate-950 bg-slate-950 text-white' : 'border-silver-200 text-silver-700 hover:bg-silver-50'}`}
                  data-no-kanban-pan="true"
                >
                  {labelViewMode(mode)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-silver-500">Operação</p>
            <select className="input h-10 py-0 text-sm" value={operacaoFiltro} onChange={event => onOperacaoFiltroChange(event.target.value)}>
              <option value="">Todas as operações</option>
              {operacoesDisponiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </div>

          {scope === 'admin' && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-silver-500">Responsável interno</p>
              <select className="input h-10 py-0 text-sm" value={responsavelFiltro} onChange={event => onResponsavelFiltroChange(event.target.value)}>
                <option value="">Todos os responsáveis</option>
                {responsaveisDisponiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </div>
          )}

          {scope === 'admin' && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-silver-500">Tag de fundo</p>
              <select className="input h-10 py-0 text-sm" value={fundoFiltro} onChange={event => onFundoFiltroChange(event.target.value)}>
                <option value="">Todos os fundos</option>
                {fundosDisponiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-silver-500">Filtro visível somente para equipe interna/admin.</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" className="btn-no-liquid btn-outline" onClick={onClear} data-no-kanban-pan="true">Limpar</button>
            <button type="button" className="btn-no-liquid btn" onClick={onClose} data-no-kanban-pan="true">Aplicar</button>
        </div>
      </div>
    </div>
  )
}

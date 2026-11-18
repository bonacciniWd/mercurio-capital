import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { ArrowRight, BriefcaseBusiness, Building2, Ellipsis, GripVertical, Loader2, Maximize2, Paperclip, Plus, Search, StickyNote, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { ReasonDialog } from '@/components/ui/reason-dialog'
import { ProspeccaoClienteDetalheModal } from '@/components/ProspeccaoClienteDetalheModal'
import type { ProspeccaoDetalheTab } from '@/components/ProspeccaoDetalheTabs'
import { supabase } from '@/lib/supabase'
import { PROSPECCAO_CLIENTE_ORIGEM_LABEL, PROSPECCAO_CLIENTE_STATUS, PROSPECCAO_CLIENTE_STATUS_LABEL, prospeccaoClienteTelefoneDisplay, type ProspeccaoCliente, type ProspeccaoClienteStatus } from '@/lib/prospeccaoCliente'
import { useProspeccaoClienteMove, useProspeccoesClientes } from '@/hooks/useProspeccoesClientes'
import { useProspeccaoClienteAnexos } from '@/hooks/useProspeccaoClienteAnexos'

type Status = ProspeccaoClienteStatus
type Detail = { prospect: ProspeccaoCliente | null; tab: ProspeccaoDetalheTab }
type Labels = { partners: Map<string, string>; teams: Map<string, string> }

export function ProspeccaoClientesBoard({ admin = false }: { admin?: boolean }) {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const highlightId = params.get('prospect')
  const query = useProspeccoesClientes()
  const prospects = useMemo(() => query.data ?? [], [query.data])
  const anexos = useProspeccaoClienteAnexos(prospects.map(row => row.id))
  const counts = new Map<string, number>()
  anexos.data?.forEach(anexo => counts.set(anexo.prospeccao_id, (counts.get(anexo.prospeccao_id) ?? 0) + 1))
  const move = useProspeccaoClienteMove()
  const moveBusy = useRef(false)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [active, setActive] = useState<ProspeccaoCliente | null>(null)
  const [loss, setLoss] = useState<ProspeccaoCliente | null>(null)
  const [expanded, setExpanded] = useState<Status | null>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [order, setOrder] = useState<'recentes' | 'antigos'>('recentes')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const board = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState(0)
  const sync = useRef(false)
  const dragClick = useRef(false)
  const pan = useRef<{ x: number; left: number } | null>(null)
  const labelsQ = useQuery({
    queryKey: ['prospeccao-clientes-rotulos', admin, session?.partnerId, session?.equipeId],
    queryFn: async (): Promise<Labels> => {
      const teams = await supabase.from('equipes').select('id, nome').order('nome')
      if (teams.error) throw teams.error
      const partners = admin ? await supabase.from('v_admin_partners').select('partner_id, nome') : { data: [], error: null }
      if (partners.error) throw partners.error
      return { partners: new Map((partners.data ?? []).map(row => [row.partner_id, row.nome])), teams: new Map((teams.data ?? []).map(row => [row.id, row.nome])) }
    },
  })
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return prospects.filter(row => !term || [row.nome_completo, row.email, row.telefone].some(value => value?.toLocaleLowerCase('pt-BR').includes(term)))
      .sort((a, b) => (order === 'recentes' ? 1 : -1) * (Date.parse(b.updated_at) - Date.parse(a.updated_at)))
  }, [prospects, search, order])
  useLayoutEffect(() => {
    const node = board.current
    if (!node) return
    function measure() { if (node) setScrollWidth(node.scrollWidth) }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [query.isPending, query.error, visible.length])
  useEffect(() => {
    if (!highlightId || query.isPending || query.error) return
    const target = document.getElementById('prospeccao-cliente-' + highlightId)
    if (!target) return
    target.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' })
    setHighlighted(highlightId)
    const timer = window.setTimeout(() => setHighlighted(null), 4000)
    return () => window.clearTimeout(timer)
  }, [highlightId, query.data, query.error, query.isPending])
  function synchronize(source: 'top' | 'board') {
    if (sync.current) return
    const from = source === 'top' ? top.current : board.current
    const to = source === 'top' ? board.current : top.current
    if (!from || !to) return
    sync.current = true; to.scrollLeft = from.scrollLeft
    window.requestAnimationFrame(() => { sync.current = false })
  }
  function open(prospect: ProspeccaoCliente | null, tab: ProspeccaoDetalheTab = 'dados') {
    if (dragClick.current) return
    setExpanded(null); setDetail({ prospect, tab })
  }
  async function applyMove(prospect: ProspeccaoCliente, next: Exclude<Status, 'proposta_criada'>, reason?: string) {
    if (moveBusy.current || prospect.status === 'proposta_criada') return
    moveBusy.current = true; setFeedback(null)
    try { await move.mutateAsync({ id: prospect.id, novo_status: next, status_esperado: prospect.status, motivo_perda: reason }); setLoss(null) }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível mover o prospect.'); throw error }
    finally { moveBusy.current = false }
  }
  function requestMove(prospect: ProspeccaoCliente, next: Status) {
    if (next === prospect.status || moveBusy.current || prospect.status === 'proposta_criada') return
    setFeedback(null)
    if (next === 'proposta_criada') { setFeedback('Para criar a proposta, use a ação “Criar proposta” em Qualificados.'); return }
    if (next === 'perdido') { setLoss(prospect); return }
    void applyMove(prospect, next).catch(() => undefined)
  }
  function endDrag(event: DragEndEvent) {
    setActive(null); dragClick.current = true
    window.setTimeout(() => { dragClick.current = false }, 120)
    const prospect = prospects.find(row => row.id === event.active.id)
    if (prospect && event.over && PROSPECCAO_CLIENTE_STATUS.includes(event.over.id as Status)) requestMove(prospect, event.over.id as Status)
  }
  const renderCard = (prospect: ProspeccaoCliente, overlay = false) => <ClienteCard prospect={prospect} admin={admin} labels={labelsQ.data} count={anexos.error ? null : counts.get(prospect.id) ?? 0} pendingCount={anexos.isPending && prospects.length > 0} busy={move.isPending} highlighted={highlighted === prospect.id} overlay={overlay} onOpen={open} onMove={requestMove} />
  const latestDetail = detail?.prospect ? prospects.find(row => row.id === detail.prospect?.id) ?? detail.prospect : null
  return <div className="min-w-0 space-y-5">
    <header className="flex flex-col gap-5 rounded-xl border border-silver-200 bg-white p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">Originação de clientes</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Prospecção de clientes</h1><p className="mt-2 text-sm text-silver-600">Acompanhe contatos, notas e prints até a criação da proposta.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><label className="relative sm:w-64"><span className="sr-only">Buscar prospect por nome, e-mail ou telefone</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" aria-hidden="true" /><input type="search" className="input w-full pl-9" placeholder="Buscar cliente…" value={search} onChange={event => setSearch(event.target.value)} /></label><button type="button" className="btn-no-liquid border border-silver-300 bg-white text-silver-800 hover:bg-silver-100" onClick={() => setOrder(current => current === 'recentes' ? 'antigos' : 'recentes')}>{order === 'recentes' ? 'Mais recentes' : 'Mais antigos'}</button><button type="button" className="btn-no-liquid bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700" onClick={() => open(null)}><Plus className="h-4 w-4" />Novo prospect</button></div>
    </header>
    <p className="text-xs text-silver-500">Arraste os cards entre as etapas ou use “Mover para…”. Abra Notas e Anexos diretamente pelo card.</p>
    {feedback && <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{feedback}</p>}
    {anexos.error && <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-silver-700" role="alert">{anexos.error.message}</p>}
    {query.isPending ? <div role="status" className="flex items-center justify-center gap-2 p-16 text-silver-500"><Loader2 className="h-6 w-6 animate-spin" />Carregando carteira…</div> : query.error ? <p className="p-8 text-danger" role="alert">{query.error.message}</p> : (
      <DndContext sensors={sensors} onDragStart={event => { dragClick.current = true; setActive(prospects.find(row => row.id === event.active.id) ?? null) }} onDragCancel={() => { setActive(null); window.setTimeout(() => { dragClick.current = false }, 120) }} onDragEnd={endDrag}>
        <div ref={top} onScroll={() => synchronize('top')} aria-hidden="true" className="overflow-x-auto rounded-md border border-silver-200 bg-white"><div style={{ width: scrollWidth, height: 12 }} /></div>
        <div ref={board} onScroll={() => synchronize('board')} className="flex gap-4 overflow-x-auto pb-4" style={{ height: 'max(28rem, calc(100dvh - 20rem))' }}
          onPointerDown={event => { if (event.button !== 0 || (event.target as HTMLElement).closest('article,button,a,input,[role="button"]')) return; pan.current = { x: event.clientX, left: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture?.(event.pointerId) }}
          onPointerMove={event => { if (pan.current) event.currentTarget.scrollLeft = pan.current.left - event.clientX + pan.current.x }} onPointerUp={() => { pan.current = null }} onPointerCancel={() => { pan.current = null }}>
          {PROSPECCAO_CLIENTE_STATUS.map(status => <ClienteColumn key={status} status={status} count={visible.filter(row => row.status === status).length} onExpand={() => setExpanded(status)}>{visible.filter(row => row.status === status).map(prospect => <DraggableCliente key={prospect.id} prospect={prospect} disabled={move.isPending}>{renderCard(prospect)}</DraggableCliente>)}</ClienteColumn>)}
        </div>
        <DragOverlay dropAnimation={null}>{active ? <div className="w-96 max-w-[calc(100vw-3rem)] shadow-xl">{renderCard(active, true)}</div> : null}</DragOverlay>
      </DndContext>
    )}
    {expanded && <ExpandedClientes status={expanded} count={visible.filter(row => row.status === expanded).length} onClose={() => setExpanded(null)}>{visible.filter(row => row.status === expanded).map(prospect => <div key={prospect.id}>{renderCard(prospect)}</div>)}</ExpandedClientes>}
    {detail && <ProspeccaoClienteDetalheModal key={detail.prospect?.id ?? 'novo'} prospect={latestDetail} admin={admin} initialTab={detail.tab} onClose={() => setDetail(null)} />}
    <ReasonDialog open={Boolean(loss)} title="Marcar prospect como perdido" description="Registre o motivo para manter o histórico comercial da carteira." context={loss?.nome_completo} confirmLabel="Marcar como perdido" reasonLabel="Motivo da perda" reasonPlaceholder="Descreva brevemente o motivo…" minLength={3} pending={move.isPending} pendingLabel="Salvando…" serverError={feedback} onClose={() => setLoss(null)} onConfirm={reason => { if (loss) void applyMove(loss, 'perdido', reason).catch(() => undefined) }} />
  </div>
}

function ClienteColumn({ status, count, onExpand, children }: { status: Status; count: number; onExpand: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return <section aria-label={PROSPECCAO_CLIENTE_STATUS_LABEL[status]} className="flex h-full w-[min(24rem,calc(100vw-3rem))] shrink-0 flex-col overflow-hidden rounded-xl border border-silver-200 bg-silver-100">
    <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-950 px-4 py-4 text-white"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{PROSPECCAO_CLIENTE_STATUS_LABEL[status]}</h2><span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{count}</span></div><button type="button" className="btn-no-liquid rounded p-1 text-white/70 hover:bg-white/10 hover:text-white" onClick={onExpand} aria-label={'Expandir ' + PROSPECCAO_CLIENTE_STATUS_LABEL[status]}><Maximize2 className="h-4 w-4" /></button></header>
    <div ref={setNodeRef} className={'min-h-0 flex-1 space-y-3 overflow-y-auto p-3 transition-colors motion-reduce:transition-none ' + (isOver ? status === 'proposta_criada' ? 'bg-silver-200' : 'bg-red-50 ring-2 ring-inset ring-red-300' : '')}>{count ? children : <p className="rounded-lg border border-dashed border-silver-300 px-4 py-8 text-center text-sm text-silver-500">{status === 'proposta_criada' ? 'As propostas convertidas aparecerão aqui.' : 'Nenhum prospect nesta etapa. Arraste um card para cá.'}</p>}</div>
  </section>
}
function DraggableCliente({ prospect, disabled, children }: { prospect: ProspeccaoCliente; disabled: boolean; children: React.ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: prospect.id, disabled: disabled || prospect.status === 'proposta_criada' })
  return <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>{children}</div>
}
function ClienteCard({ prospect, admin, labels, count, pendingCount, busy, highlighted, overlay, onOpen, onMove }: {
  prospect: ProspeccaoCliente; admin: boolean; labels?: Labels; count: number | null; pendingCount: boolean; busy: boolean; highlighted: boolean; overlay: boolean
  onOpen: (prospect: ProspeccaoCliente, tab?: ProspeccaoDetalheTab) => void; onMove: (prospect: ProspeccaoCliente, next: Status) => void
}) {
  return <article id={overlay ? undefined : 'prospeccao-cliente-' + prospect.id} data-highlighted={highlighted ? 'true' : undefined} className={'overflow-hidden rounded-xl border bg-white shadow-sm ' + (highlighted ? 'border-red-500 ring-2 ring-red-200' : 'border-silver-200')} onClick={event => { if (!(event.target as HTMLElement).closest('button,a,input,select')) onOpen(prospect) }}>
    <div className="p-4"><div className="flex items-start gap-2"><GripVertical className="mt-1 h-4 w-4 shrink-0 text-silver-300" aria-hidden="true" /><div className="min-w-0 flex-1"><button type="button" onPointerDown={event => event.stopPropagation()} onClick={() => onOpen(prospect)} className="btn-no-liquid line-clamp-2 p-0 text-left text-base font-semibold text-slate-950 hover:text-red-700" aria-label={'Detalhes de ' + prospect.nome_completo}>{prospect.nome_completo}</button>{prospect.email && <p className="mt-2 break-all text-sm text-silver-600">{prospect.email}</p>}{prospect.telefone && <p className="mt-1 text-sm text-silver-600">{prospeccaoClienteTelefoneDisplay(prospect.telefone)}</p>}</div>{!overlay && prospect.status !== 'proposta_criada' && <ClienteMenu prospect={prospect} busy={busy} onMove={onMove} />}</div>
      <div className="mt-4 flex flex-wrap gap-2">{prospect.origem && <span className="rounded-full border border-silver-200 px-2 py-1 text-[11px] font-semibold text-silver-600">{PROSPECCAO_CLIENTE_ORIGEM_LABEL[prospect.origem]}</span>}</div>
      {admin && <p className="mt-3 flex items-center gap-1.5 text-xs text-silver-500"><BriefcaseBusiness className="h-3.5 w-3.5" />{labels?.partners.get(prospect.partner_id) ?? 'Parceiro atribuído'}</p>}{prospect.equipe_id && <p className="mt-2 flex items-center gap-1.5 text-xs text-silver-500"><Building2 className="h-3.5 w-3.5" />{labels?.teams.get(prospect.equipe_id) ?? 'Equipe atribuída'}</p>}
      {prospect.notas && <p className="mt-4 line-clamp-2 whitespace-pre-wrap break-words rounded-lg bg-silver-50 p-3 text-sm text-silver-600">{prospect.notas}</p>}{prospect.motivo_perda && <p className="mt-3 break-words rounded-lg bg-red-50 p-3 text-xs text-red-800">Perda: {prospect.motivo_perda}</p>}
    </div>
    {!overlay && <div className="space-y-3 border-t border-silver-100 bg-silver-50/70 px-4 py-3" onPointerDown={event => event.stopPropagation()}><div className="flex items-center justify-between gap-2"><button type="button" className="btn-no-liquid inline-flex items-center gap-1.5 rounded py-1 text-xs font-semibold text-silver-700 hover:text-red-700" onClick={() => onOpen(prospect, 'notas')}><StickyNote className="h-4 w-4" />Notas</button><button type="button" className="btn-no-liquid inline-flex items-center gap-1.5 rounded py-1 text-xs font-semibold text-silver-700 hover:text-red-700" onClick={() => onOpen(prospect, 'anexos')}><Paperclip className="h-4 w-4" />Anexos <span>{pendingCount ? '…' : count ?? 'Indisponível'}</span></button></div>{prospect.status === 'qualificado' && <Link className="btn-no-liquid flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700" to={(admin ? '/admin' : '/p') + '/propostas/nova?prospeccao_cliente=' + prospect.id}>Criar proposta <ArrowRight className="h-4 w-4" /></Link>}{prospect.proposta_id && <Link className="btn-no-liquid inline-flex items-center gap-1 text-sm font-semibold text-red-700" to={(admin ? '/admin' : '/p') + '/propostas/' + prospect.proposta_id}>Abrir proposta <ArrowRight className="h-4 w-4" /></Link>}</div>}
  </article>
}
function ClienteMenu({ prospect, busy, onMove }: { prospect: ProspeccaoCliente; busy: boolean; onMove: (prospect: ProspeccaoCliente, next: Status) => void }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!open) return
    function place() { const rect = anchor.current?.getBoundingClientRect(); const height = menu.current?.offsetHeight ?? 190; if (rect) setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - height - 8)), left: Math.max(8, Math.min(rect.right - 240, window.innerWidth - 248)) }) }
    place(); window.addEventListener('scroll', place, true); window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [open])
  useEffect(() => { if (open) menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus() }, [open])
  function finish() { setOpen(false); anchor.current?.focus() }
  return <div onPointerDown={event => event.stopPropagation()}><button ref={anchor} type="button" aria-label={'Ações de ' + prospect.nome_completo} aria-expanded={open} aria-haspopup="menu" className="btn-no-liquid rounded p-1 text-silver-500 hover:bg-silver-100" onClick={() => setOpen(current => !current)}><Ellipsis className="h-5 w-5" /></button>{open && createPortal(<div onPointerDown={event => event.stopPropagation()}>
    <div className="fixed inset-0 z-[79]" aria-hidden="true" onClick={finish} />
    <div ref={menu} role="menu" aria-label={'Mover ' + prospect.nome_completo + ' para outra etapa'} className="fixed z-[80] w-60 max-w-[calc(100vw-1rem)] rounded-lg border border-silver-200 bg-white p-1 shadow-xl" style={position} onKeyDown={event => { const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); const index = items.indexOf(document.activeElement as HTMLButtonElement); if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); event.stopPropagation(); finish() } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus() } }}>
      <p className="px-3 py-2 text-xs font-semibold text-silver-500">Mover para…</p>{PROSPECCAO_CLIENTE_STATUS.filter(status => status !== 'proposta_criada').map(status => <button key={status} type="button" role="menuitem" disabled={busy || status === prospect.status} className="btn-no-liquid block w-full rounded px-3 py-2 text-left text-sm text-silver-700 hover:bg-silver-50 disabled:opacity-40" onClick={() => { finish(); onMove(prospect, status) }}>{status === 'perdido' ? 'Marcar perdido…' : PROSPECCAO_CLIENTE_STATUS_LABEL[status]}</button>)}
    </div>
  </div>, document.body)}</div>
}
function ExpandedClientes({ status, count, children, onClose }: { status: Status; count: number; children: React.ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose); close.current = onClose
  useEffect(() => {
    const opener = document.activeElement
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function key(event: KeyboardEvent) { if (event.defaultPrevented) return; if (event.key === 'Escape') close.current(); if (event.key === 'Tab') { const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? []); const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() } } }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); if (opener instanceof HTMLElement && opener.isConnected) opener.focus() }
  }, [])
  return createPortal(<div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 sm:p-8" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div ref={panel} role="dialog" aria-modal="true" aria-label={'Etapa ' + PROSPECCAO_CLIENTE_STATUS_LABEL[status]} className="flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"><header className="flex items-center justify-between gap-3 border-b border-silver-200 p-5"><h2 className="text-lg font-bold text-slate-950">{PROSPECCAO_CLIENTE_STATUS_LABEL[status]} ({count})</h2><button type="button" className="btn-no-liquid border border-silver-300 bg-white text-silver-800 hover:bg-silver-100" onClick={onClose}><X className="h-4 w-4" />Fechar</button></header><div className="grid gap-4 overflow-y-auto bg-silver-50 p-5 sm:grid-cols-2 xl:grid-cols-3">{count ? children : <p className="text-sm text-silver-500">Nenhum prospect nesta etapa.</p>}</div></div></div>, document.body)
}

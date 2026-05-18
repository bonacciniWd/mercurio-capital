import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

const STATUS_ORDER = [
  'pre_analise',
  'analise_credito',
  'analise_imovel',
  'analise_juridica',
  'comite',
  'proposta_cliente',
  'resolucao_pendencias',
  'emissao_contrato',
  'aguardando_assinatura',
  'em_registro',
  'contrato_registrado',
  'recurso_liberado',
] as const

type Status = typeof STATUS_ORDER[number]

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de Crédito',
  analise_imovel: 'Análise de Imóvel',
  analise_juridica: 'Análise Jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Proposta ao Cliente',
  resolucao_pendencias: 'Pendências',
  emissao_contrato: 'Emissão de Contrato',
  aguardando_assinatura: 'Aguard. Assinatura',
  em_registro: 'Em Registro',
  contrato_registrado: 'Contrato Registrado',
  recurso_liberado: 'Recurso Liberado',
  cancelado: 'Cancelada',
}

const PRODUTO_DOT: Record<string, string> = {
  home_equity: 'bg-navy',
  credito_construcao: 'bg-gold',
  financiamento_imobiliario: 'bg-blue-500',
}

interface Card {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  created_at: string
  cliente: { nome_completo: string } | null
  partner: { usuario: { nome_completo: string | null } | null } | null
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function AdminKanban() {
  const qc = useQueryClient()
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [busca, setBusca] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const { data: propostas, isLoading } = useQuery({
    queryKey: ['admin-kanban-propostas'],
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, created_at, cliente:clientes(nome_completo), partner:partners(usuario:usuarios(nome_completo))')
        .neq('status', 'cancelado')
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data || []) as unknown as Card[]
    },
  })

  // Realtime: invalida na alteração de qualquer proposta
  useEffect(() => {
    const channel = supabase
      .channel('admin-kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propostas' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-kanban-propostas'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  const filtradas = useMemo(() => {
    if (!propostas) return []
    const term = busca.trim().toLowerCase()
    if (!term) return propostas
    return propostas.filter((p) => {
      const hay = [p.protocolo, p.cliente?.nome_completo, p.partner?.usuario?.nome_completo]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [propostas, busca])

  const byStatus = useMemo(() => {
    const map: Record<string, Card[]> = {}
    STATUS_ORDER.forEach((s) => { map[s] = [] })
    filtradas.forEach((p) => {
      if (map[p.status]) map[p.status].push(p)
    })
    return map
  }, [filtradas])

  async function moverPara(card: Card, novoStatus: Status) {
    if (card.status === novoStatus) return
    // Otimista: atualiza o cache local antes do RPC
    qc.setQueryData<Card[]>(['admin-kanban-propostas'], (old) =>
      (old || []).map((c) => (c.id === card.id ? { ...c, status: novoStatus } : c))
    )
    const { error } = await supabase.rpc('admin_set_proposta_status', {
      p_id: card.id,
      p_status: novoStatus,
      p_motivo: 'Movido via Kanban',
    })
    if (error) {
      // rollback
      qc.invalidateQueries({ queryKey: ['admin-kanban-propostas'] })
      alert('Falha ao mover: ' + error.message)
    }
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    const card = propostas?.find((p) => p.id === id) || null
    setActiveCard(card)
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null)
    if (!e.over) return
    const card = propostas?.find((p) => p.id === String(e.active.id))
    if (!card) return
    const novo = String(e.over.id) as Status
    moverPara(card, novo)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Kanban de propostas</h1>
          <p className="text-sm text-silver-600">Arraste cards para mudar o status. Atualizações em tempo real.</p>
        </div>
        <Link to="/admin/propostas" className="btn-outline">Ver lista</Link>
      </div>

      <div className="card mb-4 p-4">
        <input
          className="input"
          placeholder="Buscar por protocolo, cliente ou parceiro"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_ORDER.map((s) => (
              <Column key={s} status={s} cards={byStatus[s] || []} />
            ))}
          </div>

          <DragOverlay>
            {activeCard ? <CardView card={activeCard} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </>
  )
}

function Column({ status, cards }: { status: Status; cards: Card[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const total = cards.reduce((s, c) => s + Number(c.valor_solicitado || 0), 0)
  return (
    <div className="w-72 shrink-0">
      <div className="rounded-t-lg bg-navy p-3 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{STATUS_LABEL[status]}</span>
          <span className="badge bg-white/15 text-white">{cards.length}</span>
        </div>
        <p className="mt-1 text-xs text-white/70">{brl(total * 100)}</p>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[200px] space-y-2 rounded-b-lg p-2 transition-colors ${isOver ? 'bg-gold/10' : 'bg-silver-100'}`}
      >
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} />
        ))}
      </div>
    </div>
  )
}

function DraggableCard({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? 'opacity-40' : ''}>
      <CardView card={card} />
    </div>
  )
}

function CardView({ card, dragging }: { card: Card; dragging?: boolean }) {
  const dias = diasDesde(card.created_at)
  return (
    <div className={`card p-3 ${dragging ? 'rotate-1 shadow-xl' : 'cursor-grab active:cursor-grabbing'}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-silver-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-silver-500">{card.protocolo || card.id.slice(0, 8)}</p>
            <span className={`h-2.5 w-2.5 rounded-full ${PRODUTO_DOT[card.produto] || 'bg-silver-400'}`} />
          </div>
          <Link
            to={`/admin/propostas/${card.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1 block text-sm font-semibold text-silver-900 hover:text-gold-700"
          >
            {card.cliente?.nome_completo || '—'}
          </Link>
          <p className="text-xs text-silver-600">
            {brl(Number(card.valor_solicitado) * 100)} · {card.partner?.usuario?.nome_completo || '—'}
          </p>
          <p className={`mt-2 text-xs ${dias > 7 ? 'font-semibold text-danger' : 'text-silver-500'}`}>
            {dias}d na esteira
          </p>
        </div>
      </div>
    </div>
  )
}

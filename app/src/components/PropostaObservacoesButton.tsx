// Botão de observações no footer do card do Kanban (issue #22, spec UX aprovada).
// Sempre visível (mesmo sem observações — senão a primeira seria impossível);
// o BADGE só aparece com contagem > 0. stopPropagation no pointerdown preserva o drag.
import { useContext } from 'react'
import { MessageSquare } from 'lucide-react'
import { ObservacoesKanbanContext } from '@/components/observacoesKanbanContext'

// Variantes: 'kanban' (footer do card, ícone só) · 'chip' (lista densa do
// dashboard — rótulo visível "Observações" + visual de chip contornado).
const CLASSES_KANBAN = 'btn-no-liquid -my-1 -mr-1 inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-silver-500 hover:bg-silver-100 hover:text-silver-700'
const CLASSES_CHIP = 'btn-no-liquid inline-flex min-h-7 items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-semibold text-black/55 hover:bg-black/[0.045] hover:text-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#151515]'

export function PropostaObservacoesButton({
  cardId,
  dragging,
  variant = 'kanban',
}: {
  cardId: string
  dragging?: boolean
  variant?: 'kanban' | 'chip'
}) {
  const ctx = useContext(ObservacoesKanbanContext)
  if (!ctx || dragging) return null // DragOverlay: clone puramente visual

  const total = ctx.contagem[cardId] ?? 0
  const totalLabel = total > 99 ? '99+' : total

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => ctx.onOpen(cardId)}
      data-no-kanban-pan="true"
      data-obs-trigger={cardId}
      title="Observações internas"
      aria-label={total > 0
        ? `Observações da proposta (${totalLabel})`
        : 'Observações da proposta (nenhuma registrada)'}
      className={variant === 'chip' ? CLASSES_CHIP : CLASSES_KANBAN}
    >
      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
      {variant === 'chip' && <span>Observações</span>}
      {total > 0 && (
        <span aria-hidden="true" className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] text-white">
          {totalLabel}
        </span>
      )}
    </button>
  )
}

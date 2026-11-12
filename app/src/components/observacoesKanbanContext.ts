// Contexto do Kanban para observações (issue #22): evita prop drilling por
// Column → DraggableCard → CardView. Provido pelo PropostasKanban.
import { createContext } from 'react'

export interface ObservacoesKanbanContextValue {
  contagem: Record<string, number>
  onOpen: (cardId: string) => void
}

export const ObservacoesKanbanContext = createContext<ObservacoesKanbanContextValue | null>(null)

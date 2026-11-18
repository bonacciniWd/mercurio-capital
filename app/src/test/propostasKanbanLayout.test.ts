import { describe, expect, it } from 'vitest'
import { PROPOSTA_KANBAN_STATUS } from '@/lib/propostaStatus'
import { propostasKanbanScrollWidth } from '@/lib/propostasKanbanLayout'

describe('largura da barra do Kanban de propostas', () => {
  it('considera a coluna legada mais estreita e os gaps do board', () => {
    const width = (PROPOSTA_KANBAN_STATUS.length * 28) + 18
    const gaps = PROPOSTA_KANBAN_STATUS.length
    expect(propostasKanbanScrollWidth(true)).toBe(`calc(${width}rem + ${gaps}rem)`)
  })

  it('não inclui a coluna legada quando ela não está visível', () => {
    const width = PROPOSTA_KANBAN_STATUS.length * 28
    const gaps = PROPOSTA_KANBAN_STATUS.length - 1
    expect(propostasKanbanScrollWidth(false)).toBe(`calc(${width}rem + ${gaps}rem)`)
  })
})

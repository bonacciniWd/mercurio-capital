import { describe, expect, it } from 'vitest'
import { dateInputToTimestamp, formatDateBr, toDateInputValue } from './dateBr'

describe('datas civis brasileiras', () => {
  it('mantém a data informada ao serializar e reabrir o formulário', () => {
    const timestamp = dateInputToTimestamp('2026-08-23')
    expect(timestamp).toBe('2026-08-23T12:00:00.000Z')
    expect(toDateInputValue(timestamp)).toBe('2026-08-23')
    expect(formatDateBr(timestamp)).toBe('23/08/2026')
  })

  it('não troca dia e mês em datas de janeiro e dezembro', () => {
    expect(formatDateBr(dateInputToTimestamp('2026-01-22'))).toBe('22/01/2026')
    expect(formatDateBr(dateInputToTimestamp('2026-12-02'))).toBe('02/12/2026')
  })

  it('preserva a data civil de registros antigos gravados à meia-noite UTC', () => {
    expect(toDateInputValue('2026-08-23T00:00:00.000Z')).toBe('2026-08-23')
    expect(formatDateBr('2026-08-23T00:00:00.000Z')).toBe('23/08/2026')
  })

  it('aplica o fuso brasileiro a instantes reais', () => {
    expect(formatDateBr('2026-08-23T02:00:00.000Z')).toBe('22/08/2026')
  })

  it('rejeita valor vazio ou formato inválido', () => {
    expect(dateInputToTimestamp('')).toBe('')
    expect(dateInputToTimestamp('23/08/2026')).toBe('')
    expect(toDateInputValue('valor inválido')).toBe('')
    expect(formatDateBr(null)).toBe('—')
  })
})

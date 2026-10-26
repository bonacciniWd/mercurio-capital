import { afterEach, describe, expect, it, vi } from 'vitest'
import { imprimirSimulacaoCreditoPdf } from './simulacaoCreditoPdf'

describe('exportação da prévia do simulador', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('abre a impressão com nome identificável e restaura o título original', () => {
    const originalTitle = document.title
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    imprimirSimulacaoCreditoPdf()

    expect(print).toHaveBeenCalledOnce()
    expect(document.title).toMatch(/^Mercurio-Capital-Previa-Simulacao-\d{4}-\d{2}-\d{2}$/)

    window.dispatchEvent(new Event('afterprint'))
    expect(document.title).toBe(originalTitle)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { cycleDialogFocus } from '@/lib/dialogFocus'

afterEach(() => { document.body.innerHTML = '' })

describe('ciclo de foco do diálogo', () => {
  it('mantém Tab e Shift+Tab dentro do diálogo', () => {
    const dialog = document.createElement('div')
    const first = document.createElement('button')
    const last = document.createElement('button')
    dialog.append(first, last)
    document.body.append(dialog)

    last.focus()
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    cycleDialogFocus(forward, dialog)
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    first.focus()
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    cycleDialogFocus(backward, dialog)
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('traz o foco de volta ao diálogo se estiver fora ao pressionar Tab', () => {
    const outside = document.createElement('button')
    const dialog = document.createElement('div')
    dialog.tabIndex = -1
    const first = document.createElement('button')
    dialog.append(first)
    document.body.append(outside, dialog)

    outside.focus()
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    cycleDialogFocus(forward, dialog)
    expect(document.activeElement).toBe(first)
  })
})

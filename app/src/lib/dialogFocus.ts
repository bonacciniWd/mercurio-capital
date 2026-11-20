const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function cycleDialogFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== 'Tab') return
  const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter(element => element.getAttribute('aria-hidden') !== 'true')
  if (!focusable.length) {
    event.preventDefault()
    dialog.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const activeInside = active instanceof HTMLElement && dialog.contains(active)
  if (event.shiftKey && (!activeInside || active === first)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (!activeInside || active === last)) {
    event.preventDefault()
    first.focus()
  }
}

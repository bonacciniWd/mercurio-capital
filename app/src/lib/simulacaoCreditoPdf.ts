export function imprimirSimulacaoCreditoPdf() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const originalTitle = document.title
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const restoreTitle = () => {
    document.title = originalTitle
    window.removeEventListener('afterprint', restoreTitle)
  }

  document.title = `Mercurio-Capital-Previa-Simulacao-${date}`
  window.addEventListener('afterprint', restoreTitle, { once: true })
  window.print()
}

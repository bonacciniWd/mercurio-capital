export type PublicSimulatorMode = 'home_equity' | 'amortizacao'

export function PublicSimulatorModeToggle({ mode, onChange }: {
  mode: PublicSimulatorMode
  onChange: (mode: PublicSimulatorMode) => void
}) {
  return (
    <div className="mx-auto mb-8 grid w-full max-w-2xl grid-cols-2 rounded-full border border-silver-300 bg-white p-1.5 shadow-[0_12px_30px_-22px_rgba(10,43,78,0.7)]" role="tablist" aria-label="Tipo de simulador">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'home_equity'}
        onClick={() => onChange('home_equity')}
        className={`btn-no-liquid min-h-12 rounded-full px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 sm:min-h-14 sm:px-5 sm:text-base ${mode === 'home_equity' ? 'bg-red-600 text-white shadow-md' : 'text-navy hover:bg-navy-50'}`}
      >
        Simulador de parcelas
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'amortizacao'}
        onClick={() => onChange('amortizacao')}
        className={`btn-no-liquid min-h-12 rounded-full px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 sm:min-h-14 sm:px-5 sm:text-base ${mode === 'amortizacao' ? 'bg-red-600 text-white shadow-md' : 'text-navy hover:bg-navy-50'}`}
      >
        Amortização
      </button>
    </div>
  )
}

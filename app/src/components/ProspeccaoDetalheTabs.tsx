import { useRef } from 'react'

export type ProspeccaoDetalheTab = 'dados' | 'notas' | 'anexos' | 'historico'
const tabs: { id: ProspeccaoDetalheTab; label: string }[] = [
  { id: 'dados', label: 'Dados' }, { id: 'notas', label: 'Notas' },
  { id: 'anexos', label: 'Anexos' }, { id: 'historico', label: 'Histórico' },
]

export function ProspeccaoDetalheTabs({ id, value, onChange }: { id: string; value: ProspeccaoDetalheTab; onChange: (tab: ProspeccaoDetalheTab) => void }) {
  const root = useRef<HTMLDivElement>(null)
  return (
    <div ref={root} role="tablist" aria-label="Detalhes da prospecção" className="flex shrink-0 gap-1 overflow-x-auto border-b border-silver-200 bg-white px-4 sm:px-6">
      {tabs.map((tab, index) => (
        <button key={tab.id} id={id + '-tab-' + tab.id} type="button" role="tab"
          aria-controls={id + '-panel-' + tab.id} aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
              : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
            if (next === null) return
            event.preventDefault()
            onChange(tabs[next].id)
            root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
          }}
          className={'btn-no-liquid shrink-0 border-b-2 px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ' + (value === tab.id ? 'border-red-600 text-red-700' : 'border-transparent text-silver-500 hover:text-silver-800')}
        >{tab.label}</button>
      ))}
    </div>
  )
}

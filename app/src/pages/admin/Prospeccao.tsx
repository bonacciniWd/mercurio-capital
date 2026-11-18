import { useEffect, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProspeccaoKanban } from '@/components/ProspeccaoKanban'
import { ProspeccaoClientesBoard } from '@/components/ProspeccaoClientesBoard'

export function AdminProspeccao() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<'parceiros' | 'clientes'>(searchParams.get('aba') === 'b2c' ? 'clientes' : 'parceiros')

  useEffect(() => {
    const requested = searchParams.get('aba') === 'b2c' ? 'clientes' : 'parceiros'
    setTab(requested)
  }, [searchParams])

  function selectTab(next: 'parceiros' | 'clientes') {
    setTab(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'clientes') params.set('aba', 'b2c')
    else params.delete('aba')
    setSearchParams(params, { replace: true })
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = tab === 'parceiros' ? 'clientes' : 'parceiros'
    selectTab(next)
    document.getElementById('prospeccao-tab-' + next)?.focus()
  }

  return (
    <div>
      <div className="mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-silver-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Funis de prospecção">
        <button id="prospeccao-tab-parceiros" type="button" role="tab" aria-selected={tab === 'parceiros'} aria-controls="prospeccao-panel" tabIndex={tab === 'parceiros' ? 0 : -1} onKeyDown={onTabKeyDown} onClick={() => selectTab('parceiros')} className={`btn-no-liquid shrink-0 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${tab === 'parceiros' ? 'bg-slate-950 text-white' : 'text-silver-600 hover:bg-silver-50 hover:text-silver-900'}`}>
          Parceiros B2B
        </button>
        <button id="prospeccao-tab-clientes" type="button" role="tab" aria-selected={tab === 'clientes'} aria-controls="prospeccao-panel" tabIndex={tab === 'clientes' ? 0 : -1} onKeyDown={onTabKeyDown} onClick={() => selectTab('clientes')} className={`btn-no-liquid shrink-0 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${tab === 'clientes' ? 'bg-slate-950 text-white' : 'text-silver-600 hover:bg-silver-50 hover:text-silver-900'}`}>
          Clientes B2C
        </button>
      </div>
      <section id="prospeccao-panel" role="tabpanel" aria-labelledby={tab === 'clientes' ? 'prospeccao-tab-clientes' : 'prospeccao-tab-parceiros'}>
        {tab === 'clientes' ? <ProspeccaoClientesBoard admin /> : <ProspeccaoKanban />}
      </section>
    </div>
  )
}

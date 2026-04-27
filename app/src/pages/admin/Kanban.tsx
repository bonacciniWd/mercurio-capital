import { brl } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

const cols = [
  { name: 'Pré-análise', cards: [
    { id: 'MC-2024-0083', cliente: 'Lucas P.', valor: 22000000, parceiro: 'Aurora', dias: 1, produto: 'HE' },
    { id: 'MC-2024-0090', cliente: 'Marina B.', valor: 31000000, parceiro: 'Vista Sul', dias: 2, produto: 'CC' },
  ]},
  { name: 'Análise Crédito', cards: [
    { id: 'MC-2024-0042', cliente: 'João Silva', valor: 35000000, parceiro: 'Aurora', dias: 5, produto: 'HE' },
    { id: 'MC-2024-0072', cliente: 'Igor S.', valor: 18000000, parceiro: 'Capital +', dias: 3, produto: 'FI' },
  ]},
  { name: 'Análise Jurídica', cards: [
    { id: 'MC-2024-0061', cliente: 'Pedro Lima', valor: 62000000, parceiro: 'Vista Sul', dias: 8, produto: 'FI' },
  ]},
  { name: 'Comitê', cards: [
    { id: 'MC-2024-0078', cliente: 'Ana Souza', valor: 48000000, parceiro: 'Aurora', dias: 4, produto: 'CC' },
    { id: 'MC-2024-0086', cliente: 'Renato G.', valor: 41000000, parceiro: 'Capital +', dias: 12, produto: 'HE' },
  ]},
  { name: 'Aguard. Assinatura', cards: [
    { id: 'MC-2024-0058', cliente: 'Camila R.', valor: 28000000, parceiro: 'Vista Sul', dias: 2, produto: 'HE' },
  ]},
  { name: 'Recurso Liberado', cards: [
    { id: 'MC-2024-0091', cliente: 'Fernanda T.', valor: 91000000, parceiro: 'Aurora', dias: 1, produto: 'CC' },
  ]},
]

const PCOLOR = { HE: 'bg-navy', CC: 'bg-gold', FI: 'bg-chart-blue' } as const

export function AdminKanban() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Kanban de propostas</h1>

      <div className="card mb-4 flex gap-3 p-4">
        <input className="input flex-1" placeholder="Buscar..." />
        <select className="input w-auto"><option>Parceiro</option></select>
        <select className="input w-auto"><option>Produto</option></select>
        <input className="input w-auto" type="date" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {cols.map(c => {
          const total = c.cards.reduce((s, x) => s + x.valor, 0)
          return (
            <div key={c.name} className="w-72 shrink-0">
              <div className="rounded-t-lg bg-navy p-3 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="badge bg-white/15 text-white">{c.cards.length}</span>
                </div>
                <p className="mt-1 text-xs text-white/70">{brl(total)}</p>
              </div>
              <div className="space-y-2 rounded-b-lg bg-silver-100 p-2 min-h-[200px]">
                {c.cards.map(card => (
                  <div key={card.id} className="card cursor-grab p-3 active:cursor-grabbing">
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-silver-400" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xs text-silver-500">{card.id}</p>
                          <span className={`h-2.5 w-2.5 rounded-full ${PCOLOR[card.produto as keyof typeof PCOLOR]}`} />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-silver-900">{card.cliente}</p>
                        <p className="text-xs text-silver-600">{brl(card.valor)} · {card.parceiro}</p>
                        <p className={`mt-2 text-xs ${card.dias > 7 ? 'text-danger font-semibold' : 'text-silver-500'}`}>
                          {card.dias}d na etapa
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

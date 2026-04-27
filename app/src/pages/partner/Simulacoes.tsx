import { Link } from 'react-router-dom'
import { brl } from '@/lib/utils'
import { StatusBadge } from '@/components/Badge'
import { Plus, Search, Filter, ArrowRightCircle } from 'lucide-react'

const sims = [
  { id: 1, data: '12/04/2026', cliente: 'João Silva', produto: 'Home Equity', credito: 35000000, imovel: 85000000, ltv: 41, prazo: 120, parcela: 423000, status: 'Convertida em Proposta' },
  { id: 2, data: '11/04/2026', cliente: 'Beatriz N.', produto: 'Construção', credito: 48000000, imovel: 90000000, ltv: 53, prazo: 180, parcela: 461000, status: 'Rascunho' },
  { id: 3, data: '10/04/2026', cliente: 'Carlos M.', produto: 'Financiamento', credito: 62000000, imovel: 95000000, ltv: 65, prazo: 240, parcela: 558000, status: 'Rascunho' },
]

export function PartnerSimulacoes() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Simulações</h1>
          <p className="text-sm text-silver-600">Acompanhe e converta simulações em propostas.</p>
        </div>
        <Link to="/p/propostas/nova" className="btn-gold"><Plus className="h-4 w-4" /> Nova simulação</Link>
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input className="input pl-9" placeholder="Buscar por cliente ou CPF" />
        </div>
        <select className="input w-auto"><option>Todos os produtos</option><option>Home Equity</option><option>Construção</option><option>Financiamento</option></select>
        <input className="input w-auto" type="date" />
        <select className="input w-auto"><option>Todos status</option><option>Rascunho</option><option>Convertida em Proposta</option></select>
        <button className="btn-outline"><Filter className="h-4 w-4" /> Filtros</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              {['Data', 'Cliente', 'Produto', 'Crédito', 'Imóvel', 'LTV', 'Prazo', 'Parcela', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sims.map(s => (
              <tr key={s.id} className="border-t border-silver-100 hover:bg-silver-50">
                <td className="px-4 py-3 text-silver-700">{s.data}</td>
                <td className="px-4 py-3 font-medium text-silver-900">{s.cliente}</td>
                <td className="px-4 py-3 text-silver-700">{s.produto}</td>
                <td className="px-4 py-3 font-medium">{brl(s.credito)}</td>
                <td className="px-4 py-3">{brl(s.imovel)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${s.ltv <= 60 ? 'bg-success/15 text-success' : s.ltv <= 70 ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'}`}>{s.ltv}%</span>
                </td>
                <td className="px-4 py-3">{s.prazo}m</td>
                <td className="px-4 py-3">{brl(s.parcela)}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3">
                  {s.status === 'Rascunho' ? (
                    <button className="inline-flex items-center gap-1 text-xs font-medium text-gold-600 hover:underline">
                      <ArrowRightCircle className="h-3.5 w-3.5" /> Converter
                    </button>
                  ) : (
                    <span className="text-xs text-silver-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

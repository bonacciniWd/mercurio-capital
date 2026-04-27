import { Link } from 'react-router-dom'
import { Search, Eye, Download } from 'lucide-react'
import { brl } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { StatusBadge } from '@/components/Badge'

const propostas = [
  { id: 'MC-2024-0042', cliente: 'João Silva', cpf: '123.456.789-00', parceiro: 'Aurora', produto: 'Home Equity', valor: 35000000, ltv: 48, status: 'Análise de Crédito', dias: 5, criada: '07/04' },
  { id: 'MC-2024-0058', cliente: 'Camila R.', cpf: '234.567.890-11', parceiro: 'Vista Sul', produto: 'Home Equity', valor: 28000000, ltv: 52, status: 'Aguardando assinatura', dias: 2, criada: '10/04' },
  { id: 'MC-2024-0061', cliente: 'Pedro Lima', cpf: '345.678.901-22', parceiro: 'Vista Sul', produto: 'Financiamento', valor: 62000000, ltv: 65, status: 'Análise Jurídica', dias: 8, criada: '04/04' },
  { id: 'MC-2024-0072', cliente: 'Igor S.', cpf: '456.789.012-33', parceiro: 'Capital +', produto: 'Financiamento', valor: 18000000, ltv: 70, status: 'Análise de Crédito', dias: 3, criada: '09/04' },
  { id: 'MC-2024-0078', cliente: 'Ana Souza', cpf: '567.890.123-44', parceiro: 'Aurora', produto: 'Construção', valor: 48000000, ltv: 60, status: 'Comitê', dias: 4, criada: '08/04' },
  { id: 'MC-2024-0083', cliente: 'Lucas P.', cpf: '678.901.234-55', parceiro: 'Aurora', produto: 'Home Equity', valor: 22000000, ltv: 45, status: 'Pré-análise', dias: 1, criada: '11/04' },
  { id: 'MC-2024-0086', cliente: 'Renato G.', cpf: '789.012.345-66', parceiro: 'Capital +', produto: 'Home Equity', valor: 41000000, ltv: 55, status: 'Comitê', dias: 12, criada: '31/03' },
  { id: 'MC-2024-0091', cliente: 'Fernanda T.', cpf: '890.123.456-77', parceiro: 'Aurora', produto: 'Construção', valor: 91000000, ltv: 58, status: 'Recurso Liberado', dias: 1, criada: '11/04' },
]

export function AdminPropostas() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Propostas — visão geral</h1>
          <p className="text-sm text-silver-600">Lista completa em todas as etapas. Use o Kanban para visualização por estágio.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/kanban" className="btn-outline">Ver Kanban</Link>
          <button className="btn-gold"><Download className="h-4 w-4" /> Exportar</button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Total ativas" value="312" />
        <KPICard label="Volume em análise" value={brl(8700000000)} intent="gold" />
        <KPICard label="LTV médio" value="56%" />
        <KPICard label="Tempo médio" value="14d" intent="warning" />
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input className="input pl-9" placeholder="Protocolo, CPF ou cliente" />
        </div>
        <select className="input w-auto"><option>Status: todos</option></select>
        <select className="input w-auto"><option>Produto</option><option>Home Equity</option><option>Construção</option><option>Financiamento</option></select>
        <select className="input w-auto"><option>Parceiro</option></select>
        <input type="date" className="input w-auto" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-4 py-3">Protocolo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Parceiro</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">LTV</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Dias</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {propostas.map(p => (
              <tr key={p.id} className="border-t border-silver-100 hover:bg-silver-50">
                <td className="px-4 py-3 font-mono text-xs text-silver-700">{p.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-silver-900">{p.cliente}</p>
                  <p className="font-mono text-xs text-silver-500">{p.cpf}</p>
                </td>
                <td className="px-4 py-3 text-silver-700">{p.parceiro}</td>
                <td className="px-4 py-3 text-silver-700">{p.produto}</td>
                <td className="px-4 py-3 text-right font-bold text-navy">{brl(p.valor)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`badge ${p.ltv > 60 ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{p.ltv}%</span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className={`px-4 py-3 text-right ${p.dias > 7 ? 'text-danger font-semibold' : 'text-silver-600'}`}>{p.dias}d</td>
                <td className="px-4 py-3">
                  <button className="rounded-md p-1.5 hover:bg-silver-100" title="Ver"><Eye className="h-4 w-4 text-silver-600" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

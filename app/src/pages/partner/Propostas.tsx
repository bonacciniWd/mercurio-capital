import { Link } from 'react-router-dom'
import { brl } from '@/lib/utils'
import { StatusBadge } from '@/components/Badge'
import { KPICard } from '@/components/KPICard'
import { Plus, Search, Download } from 'lucide-react'

const dados = [
  { id: 'MC-2024-0042', cliente: 'João Silva', produto: 'Home Equity', valor: 35000000, resp: 'Mariana', status: 'Análise de Crédito', upd: 'há 2h' },
  { id: 'MC-2024-0061', cliente: 'Pedro Lima', produto: 'Financiamento', valor: 62000000, resp: 'Carlos', status: 'Análise Jurídica', upd: 'ontem' },
  { id: 'MC-2024-0078', cliente: 'Ana Souza', produto: 'Construção', valor: 48000000, resp: 'Mariana', status: 'Comitê', upd: 'há 3 dias' },
  { id: 'MC-2024-0083', cliente: 'Lucas P.', produto: 'Home Equity', valor: 22000000, resp: 'Carlos', status: 'Pré-análise', upd: 'há 1h' },
  { id: 'MC-2024-0091', cliente: 'Fernanda T.', produto: 'Construção', valor: 91000000, resp: 'Mariana', status: 'Recurso Liberado', upd: 'há 5 dias' },
]

export function PartnerPropostas() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-navy">Propostas</h1>
        <Link to="/p/propostas/nova" className="btn-gold"><Plus className="h-4 w-4" /> Nova proposta</Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Total" value="28" />
        <KPICard label="Em andamento" value="18" intent="warning" />
        <KPICard label="Aguardando cliente" value="4" />
        <KPICard label="Finalizadas" value="6" intent="success" />
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input className="input pl-9" placeholder="Buscar por protocolo, cliente ou CPF" />
        </div>
        <select className="input w-auto"><option>Produto</option></select>
        <select className="input w-auto"><option>Status</option></select>
        <select className="input w-auto"><option>Responsável</option></select>
        <button className="btn-outline"><Download className="h-4 w-4" /> Exportar XLSX</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              {['Protocolo', 'Cliente', 'Produto', 'Valor', 'Responsável', 'Status', 'Atualização'].map(h => (
                <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map(d => (
              <tr key={d.id} className="cursor-pointer border-t border-silver-100 hover:bg-silver-50">
                <td className="px-4 py-3"><Link to={`/p/propostas/${d.id}`} className="font-mono text-navy hover:underline">{d.id}</Link></td>
                <td className="px-4 py-3 font-medium text-silver-900">{d.cliente}</td>
                <td className="px-4 py-3 text-silver-700">{d.produto}</td>
                <td className="px-4 py-3 font-medium">{brl(d.valor)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">{d.resp[0]}</div>
                    <span className="text-silver-700">{d.resp}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3 text-xs text-silver-500">{d.upd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

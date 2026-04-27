import { useState } from 'react'
import { Search, Eye, Lock, Unlock, MoreVertical, Plus } from 'lucide-react'
import { brl } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { Badge } from '@/components/Badge'

const parceiros = [
  { id: 1, nome: 'Construtora Aurora LTDA', cnpj: '12.345.678/0001-90', cidade: 'São Paulo/SP', resp: 'João Silva', email: 'joao@aurora.com', equipe: 8, propostas: 12, volume: 4200000000, saldo: 125000, status: 'Ativo', desde: '03/01/2025' },
  { id: 2, nome: 'Imobiliária Vista Sul', cnpj: '23.456.789/0001-01', cidade: 'Curitiba/PR', resp: 'Maria T.', email: 'maria@vistasul.com', equipe: 5, propostas: 9, volume: 2800000000, saldo: 1850, status: 'Ativo', desde: '12/02/2025' },
  { id: 3, nome: 'Capital Mais Crédito', cnpj: '34.567.890/0001-12', cidade: 'Belo Horizonte/MG', resp: 'Pedro L.', email: 'pedro@capitalmais.com', equipe: 3, propostas: 4, volume: 1500000000, saldo: 0, status: 'Bloqueado', desde: '20/03/2025' },
  { id: 4, nome: 'Valor Imobiliário', cnpj: '45.678.901/0001-23', cidade: 'Porto Alegre/RS', resp: 'Carlos M.', email: 'carlos@valor.com', equipe: 6, propostas: 7, volume: 3100000000, saldo: 80000, status: 'Ativo', desde: '08/01/2025' },
  { id: 5, nome: 'Norte Crédito SA', cnpj: '56.789.012/0001-34', cidade: 'Recife/PE', resp: 'Helena R.', email: 'helena@norte.com', equipe: 4, propostas: 5, volume: 1900000000, saldo: 42000, status: 'Ativo', desde: '15/03/2025' },
  { id: 6, nome: 'Premium Crédito', cnpj: '67.890.123/0001-45', cidade: 'Brasília/DF', resp: 'Felipe A.', email: 'felipe@premium.com', equipe: 2, propostas: 0, volume: 0, saldo: 5000, status: 'Inativo', desde: '01/04/2025' },
]

const STATUS_VAR = { Ativo: 'green', Bloqueado: 'red', Inativo: 'gray' } as const

export function AdminParceiros() {
  const [filter, setFilter] = useState('')
  const list = parceiros.filter(p => p.nome.toLowerCase().includes(filter.toLowerCase()) || p.cnpj.includes(filter))
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Parceiros</h1>
          <p className="text-sm text-silver-600">Gestão completa da rede de originação.</p>
        </div>
        <button className="btn-gold"><Plus className="h-4 w-4" /> Convidar parceiro</button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Parceiros ativos" value="47" intent="success" />
        <KPICard label="Bloqueados" value="3" intent="danger" />
        <KPICard label="Volume total" value={brl(13500000000)} intent="gold" />
        <KPICard label="Propostas no mês" value="312" />
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input value={filter} onChange={e => setFilter(e.target.value)} className="input pl-9" placeholder="Buscar por nome ou CNPJ" />
        </div>
        <select className="input w-auto"><option>Status: todos</option><option>Ativo</option><option>Bloqueado</option><option>Inativo</option></select>
        <select className="input w-auto"><option>Cidade: todas</option></select>
        <select className="input w-auto"><option>Volume: maior</option><option>Volume: menor</option></select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-4 py-3">Parceiro</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3 text-right">Equipe</th>
              <th className="px-4 py-3 text-right">Propostas</th>
              <th className="px-4 py-3 text-right">Volume</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id} className="border-t border-silver-100 hover:bg-silver-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-silver-900">{p.nome}</p>
                  <p className="font-mono text-xs text-silver-500">{p.cnpj} · {p.cidade}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-silver-800">{p.resp}</p>
                  <p className="text-xs text-silver-500">{p.email}</p>
                </td>
                <td className="px-4 py-3 text-right">{p.equipe}</td>
                <td className="px-4 py-3 text-right font-medium">{p.propostas}</td>
                <td className="px-4 py-3 text-right font-bold text-navy">{brl(p.volume)}</td>
                <td className={`px-4 py-3 text-right ${p.saldo < 2000 ? 'text-danger font-semibold' : 'text-silver-700'}`}>{brl(p.saldo)}</td>
                <td className="px-4 py-3"><Badge variant={STATUS_VAR[p.status as keyof typeof STATUS_VAR]}>{p.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-silver-600">{p.desde}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="rounded-md p-1.5 hover:bg-silver-100" title="Ver"><Eye className="h-4 w-4 text-silver-600" /></button>
                    {p.status === 'Ativo'
                      ? <button className="rounded-md p-1.5 hover:bg-danger/10" title="Bloquear"><Lock className="h-4 w-4 text-danger" /></button>
                      : <button className="rounded-md p-1.5 hover:bg-success/10" title="Reativar"><Unlock className="h-4 w-4 text-success" /></button>}
                    <button className="rounded-md p-1.5 hover:bg-silver-100"><MoreVertical className="h-4 w-4 text-silver-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

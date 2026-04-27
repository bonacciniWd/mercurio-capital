import { brl } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { Badge } from '@/components/Badge'
import { AlertTriangle, Lock, Unlock, FileText, Plus, Minus } from 'lucide-react'

const carteiras = [
  { nome: 'Construtora Aurora', cnpj: '12.345.678/0001-90', saldo: 125000, limite: 50000, status: 'Ativa', topup: '12/04', debit: '12/04' },
  { nome: 'Imobiliária Vista Sul', cnpj: '23.456.789/0001-01', saldo: 1850, limite: 30000, status: 'Ativa', topup: '08/04', debit: '11/04', low: true },
  { nome: 'Capital Mais Crédito', cnpj: '34.567.890/0001-12', saldo: 0, limite: 0, status: 'Bloqueada', topup: '02/03', debit: '03/03' },
  { nome: 'Valor Imobiliário', cnpj: '45.678.901/0001-23', saldo: 80000, limite: 40000, status: 'Ativa', topup: '10/04', debit: '12/04' },
]

export function AdminCarteiras() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Carteiras dos parceiros</h1>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Total em carteiras" value={brl(1850000)} intent="gold" />
        <KPICard label="Recargas hoje" value={brl(230000)} intent="success" />
        <KPICard label="Débitos hoje" value={brl(89000)} />
        <KPICard label="Saldo baixo" value="4" intent="danger" hint="parceiros < R$ 20" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Saldo</th><th className="px-4 py-3">Limite diário</th>
              <th className="px-4 py-3">Status</th><th className="px-4 py-3">Última recarga</th><th className="px-4 py-3">Último débito</th><th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carteiras.map(c => (
              <tr key={c.cnpj} className={`border-t border-silver-100 ${c.low ? 'bg-warning/5' : c.status === 'Bloqueada' ? 'bg-danger/5' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-silver-900">{c.nome}</p>
                  <p className="font-mono text-xs text-silver-500">{c.cnpj}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${c.saldo < 2000 ? 'text-danger' : 'text-navy'}`}>{brl(c.saldo)}</span>
                  {c.low && <AlertTriangle className="ml-2 inline h-3.5 w-3.5 text-warning" />}
                </td>
                <td className="px-4 py-3">{c.limite ? brl(c.limite) : '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={c.status === 'Ativa' ? 'green' : 'red'}>{c.status}</Badge>
                </td>
                <td className="px-4 py-3 text-silver-700">{c.topup}</td>
                <td className="px-4 py-3 text-silver-700">{c.debit}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 text-xs">
                    <button className="rounded-md p-1.5 hover:bg-silver-100" title="Extrato"><FileText className="h-4 w-4 text-silver-600" /></button>
                    <button className="rounded-md p-1.5 hover:bg-success/10" title="Crédito"><Plus className="h-4 w-4 text-success" /></button>
                    <button className="rounded-md p-1.5 hover:bg-warning/10" title="Débito"><Minus className="h-4 w-4 text-warning" /></button>
                    {c.status === 'Ativa'
                      ? <button className="rounded-md p-1.5 hover:bg-danger/10" title="Bloquear"><Lock className="h-4 w-4 text-danger" /></button>
                      : <button className="rounded-md p-1.5 hover:bg-success/10" title="Desbloquear"><Unlock className="h-4 w-4 text-success" /></button>}
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

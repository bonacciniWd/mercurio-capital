import { useState } from 'react'
import { Search, Eye, Check, X, FileText } from 'lucide-react'
import { StatusBadge } from '@/components/Badge'

const rows = [
  { id: 1, nome: 'Construtora Aurora LTDA', cnpj: '12.345.678/0001-90', resp: 'João Silva', data: '12/04/2026', docs: 5, status: 'Pendente' },
  { id: 2, nome: 'Imobiliária Vista Sul', cnpj: '23.456.789/0001-01', resp: 'Maria T.', data: '11/04/2026', docs: 4, status: 'Pendente' },
  { id: 3, nome: 'Capital Mais Crédito', cnpj: '34.567.890/0001-12', resp: 'Pedro L.', data: '10/04/2026', docs: 6, status: 'Pendente' },
  { id: 4, nome: 'Norte Crédito SA', cnpj: '56.789.012/0001-34', resp: 'Helena R.', data: '03/04/2026', docs: 4, status: 'Aprovado' },
  { id: 5, nome: 'Valor Imobiliário', cnpj: '45.678.901/0001-23', resp: 'Carlos M.', data: '01/04/2026', docs: 5, status: 'Suspenso' },
]

export function AdminAprovacoes() {
  const [active, setActive] = useState<number | null>(1)
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Aprovações de parceiros</h1>
          <p className="text-sm text-silver-600">Revise documentação e libere o acesso ao painel.</p>
        </div>
        <span className="badge bg-warning/15 text-warning">8 pendentes</span>
      </div>

      <div className="card mb-4 flex gap-3 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input className="input pl-9" placeholder="Buscar parceiro ou CNPJ" />
        </div>
        <select className="input w-auto"><option>Pendente</option><option>Aprovado</option><option>Suspenso</option></select>
        <input className="input w-auto" type="date" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                <th className="px-4 py-3">Parceiro</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => setActive(r.id)}
                  className={`cursor-pointer border-t border-silver-100 ${active === r.id ? 'bg-gold/5' : 'hover:bg-silver-50'}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-silver-900">{r.nome}</p>
                    <p className="font-mono text-xs text-silver-500">{r.cnpj}</p>
                  </td>
                  <td className="px-4 py-3 text-silver-700">{r.resp}</td>
                  <td className="px-4 py-3 text-silver-700">{r.data}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="rounded-md p-1.5 hover:bg-silver-100" title="Ver"><Eye className="h-4 w-4 text-silver-600" /></button>
                      <button className="rounded-md p-1.5 hover:bg-success/10" title="Aprovar"><Check className="h-4 w-4 text-success" /></button>
                      <button className="rounded-md p-1.5 hover:bg-danger/10" title="Recusar"><X className="h-4 w-4 text-danger" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="card p-5 h-fit">
          <h3 className="font-semibold text-navy">Documentos enviados</h3>
          {active && (
            <>
              <p className="mt-1 text-xs text-silver-500">{rows.find(r => r.id === active)?.nome}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {['Cartão CNPJ', 'Contrato social', 'Comprovante endereço', 'CPF do responsável'].map(d => (
                  <label key={d} className="rounded-lg border border-silver-200 p-3 text-center text-xs hover:border-gold cursor-pointer">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-silver-400" />
                    <p className="font-medium text-silver-800">{d}</p>
                    <input type="checkbox" defaultChecked className="mt-2 h-4 w-4 accent-gold" />
                  </label>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <button className="btn-gold flex-1"><Check className="h-4 w-4" /> Aprovar</button>
                <button className="btn-outline flex-1 border-danger text-danger hover:bg-danger/5"><X className="h-4 w-4" /> Recusar</button>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  )
}

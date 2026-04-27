import { brl } from '@/lib/utils'
import { Badge } from '@/components/Badge'
import { Edit2 } from 'lucide-react'

const precos = [
  { tipo: 'Serasa PF', preco: 490, desde: '01/01/2026', vigente: true },
  { tipo: 'Serasa PJ', preco: 790, desde: '01/01/2026', vigente: true },
  { tipo: 'Bacen CPF', preco: 250, desde: '15/02/2026', vigente: true },
  { tipo: 'Bacen CNPJ', preco: 350, desde: '15/02/2026', vigente: true },
  { tipo: 'Jusbrasil CNPJ', preco: 500, desde: '01/01/2026', vigente: true },
  { tipo: 'Escavador CNPJ', preco: 420, desde: '20/03/2026', vigente: true },
  { tipo: 'RI Digital — matrícula', preco: 990, desde: '01/01/2026', vigente: true },
  { tipo: 'Nacional Consultas — bens', preco: 750, desde: '10/02/2026', vigente: true },
  { tipo: 'Nacional Consultas — certidão', preco: 850, desde: '10/02/2026', vigente: true },
]

export function AdminPrecos() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Preços de consulta</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-5 py-3">Tipo de consulta</th>
              <th className="px-5 py-3">Preço atual</th>
              <th className="px-5 py-3">Vigente desde</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {precos.map(p => (
              <tr key={p.tipo} className="border-t border-silver-100 hover:bg-silver-50">
                <td className="px-5 py-3 font-medium text-silver-900">{p.tipo}</td>
                <td className="px-5 py-3 font-bold text-navy">{brl(p.preco)}</td>
                <td className="px-5 py-3 text-silver-700">{p.desde}</td>
                <td className="px-5 py-3"><Badge variant="green">Vigente</Badge></td>
                <td className="px-5 py-3">
                  <button className="inline-flex items-center gap-1 text-sm font-medium text-gold-600 hover:underline">
                    <Edit2 className="h-3.5 w-3.5" /> Novo preço
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-silver-800">Ver histórico de preços</summary>
        <p className="mt-3 text-sm text-silver-500">Versões anteriores são preservadas para auditoria — colocar tabela completa.</p>
      </details>
    </>
  )
}

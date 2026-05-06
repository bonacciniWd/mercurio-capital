import { Link } from 'react-router-dom'
import { brl } from '@/lib/utils'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { Plus, Search } from 'lucide-react'
import { StatusBadge } from '@/components/Badge'

const funnel = [
  { name: 'Simulações', value: 87 },
  { name: 'Pré-análise', value: 56 },
  { name: 'Análise', value: 32 },
  { name: 'Comitê', value: 14 },
  { name: 'Contrato', value: 8 },
]

const propostas = [
  { id: 'MC-2024-0042', cliente: 'João Silva', produto: 'Home Equity', valor: 35000000, status: 'Análise de Crédito', resp: 'Mariana' },
  { id: 'MC-2024-0061', cliente: 'Pedro Lima', produto: 'Financiamento', valor: 62000000, status: 'Análise Jurídica', resp: 'Carlos' },
  { id: 'MC-2024-0078', cliente: 'Ana Souza', produto: 'Construção', valor: 48000000, status: 'Comitê', resp: 'Mariana' },
  { id: 'MC-2024-0083', cliente: 'Lucas P.', produto: 'Home Equity', valor: 22000000, status: 'Pré-análise', resp: 'Carlos' },
  { id: 'MC-2024-0091', cliente: 'Fernanda T.', produto: 'Construção', valor: 91000000, status: 'Recurso Liberado', resp: 'Mariana' },
]

export function PartnerDashboard() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-silver-900">Dashboard</h1>
          <p className="text-sm text-silver-500">Visão geral das operações da sua carteira.</p>
        </div>
        <Link to="/p/propostas/nova" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: '#DC2626' }}><Plus className="h-4 w-4" /> Nova proposta</Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          { label: 'Propostas ativas',   value: '12',           accent: '#737373' },
          { label: 'Em análise',         value: '5',            accent: '#F59E0B' },
          { label: 'Contratos assinados',value: '3',            accent: '#16A34A' },
          { label: 'Volume total',       value: brl(420000000), accent: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border bg-white p-4" style={{ borderTopWidth: 2, borderTopColor: k.accent, borderColor: '#e5e7eb' }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-silver-500">{k.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-silver-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2" style={{ borderTop: '2px solid #DC2626' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-silver-900">Funil de conversão</h2>
            <span className="text-xs text-silver-500">Últimos 30 dias</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel}>
              <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
              <Tooltip cursor={{ fill: 'rgba(220,38,38,0.05)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {funnel.map((_, i) => <Cell key={i} fill={i === funnel.length - 1 ? '#DC2626' : '#2a2a2a'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5" style={{ borderTop: '2px solid #F59E0B' }}>
          <h2 className="mb-4 font-semibold text-silver-900">Pendências</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between border-b border-silver-100 pb-3"><span className="text-silver-700">Documentos pendentes</span><span className="font-bold" style={{ color: '#DC2626' }}>7</span></li>
            <li className="flex items-center justify-between border-b border-silver-100 pb-3"><span className="text-silver-700">Aguardando assinatura</span><span className="font-bold" style={{ color: '#F59E0B' }}>3</span></li>
            <li className="flex items-center justify-between border-b border-silver-100 pb-3"><span className="text-silver-700">Saldo de carteira</span><span className="font-bold" style={{ color: '#DC2626' }}>{brl(125000)}</span></li>
            <li className="flex items-center justify-between"><span className="text-silver-700">Notificações novas</span><span className="font-bold text-silver-900">12</span></li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ borderTop: '2px solid #DC2626' }}>
        <div className="flex items-center justify-between border-b border-silver-200 p-5">
          <h2 className="font-semibold text-silver-900">Propostas recentes</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
            <input className="input pl-9" placeholder="Buscar..." />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
            <tr>
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Produto</th>
              <th className="px-5 py-3">Valor</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {propostas.map(p => (
              <tr key={p.id} className="border-t border-silver-100 hover:bg-silver-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-silver-900">{p.cliente}</p>
                  <p className="font-mono text-xs text-silver-500">{p.id}</p>
                </td>
                <td className="px-5 py-3 text-silver-700">{p.produto}</td>
                <td className="px-5 py-3 font-medium" style={{ color: '#DC2626' }}>{brl(p.valor)}</td>
                <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-5 py-3 text-silver-700">{p.resp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

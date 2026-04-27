import { brl } from '@/lib/utils'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, FileText } from 'lucide-react'

const monthly = [
  { m: 'Jan', v: 14 }, { m: 'Fev', v: 18 }, { m: 'Mar', v: 22 }, { m: 'Abr', v: 19 },
  { m: 'Mai', v: 24 }, { m: 'Jun', v: 28 }, { m: 'Jul', v: 30 }, { m: 'Ago', v: 26 },
  { m: 'Set', v: 32 }, { m: 'Out', v: 35 }, { m: 'Nov', v: 38 }, { m: 'Dez', v: 41 },
]
const products = [
  { name: 'Home Equity', value: 48 }, { name: 'Construção', value: 27 }, { name: 'Financiamento', value: 25 },
]
const colors = ['#0A2B4E', '#D4AF37', '#2C6B9E']
const team = [
  { name: 'Mariana', count: 22 }, { name: 'Carlos', count: 14 }, { name: 'Beatriz', count: 9 },
]
const funnel = [
  { stage: 'Simulações', count: 87 }, { stage: 'Pré-análise', count: 56 }, { stage: 'Análise', count: 32 }, { stage: 'Comitê', count: 14 }, { stage: 'Contrato', count: 8 },
]

export function PartnerRelatorios() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-navy">Relatórios</h1>
        <div className="flex gap-2">
          <button className="btn-outline"><Download className="h-4 w-4" /> Excel</button>
          <button className="btn-outline"><FileText className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      <div className="card mb-6 flex flex-wrap gap-3 p-4">
        <input className="input w-auto" type="date" />
        <input className="input w-auto" type="date" />
        <select className="input w-auto"><option>Produto</option></select>
        <select className="input w-auto"><option>Equipe</option></select>
        <select className="input w-auto"><option>Status</option></select>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Funil de conversão">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
              <YAxis type="category" dataKey="stage" stroke="#9CA3AF" fontSize={12} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#2C6B9E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume mensal">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis dataKey="m" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="v" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#0A2B4E', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Por produto (%)">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={products} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {products.map((_, i) => <Cell key={i} fill={colors[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            {products.map((p, i) => (
              <span key={p.name} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} /> {p.name}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Performance por colaborador">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={team}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#0A2B4E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr><th className="px-5 py-3">Status</th><th className="px-5 py-3">Quantidade</th><th className="px-5 py-3">Volume</th><th className="px-5 py-3">Ticket médio</th></tr>
          </thead>
          <tbody>
            {[
              ['Pré-análise', 8, 32000000, 4000000],
              ['Análise', 5, 24500000, 4900000],
              ['Comitê', 3, 18000000, 6000000],
              ['Recurso liberado', 2, 9100000, 4550000],
            ].map(([s, q, v, t]) => (
              <tr key={s as string} className="border-t border-silver-100">
                <td className="px-5 py-3">{s}</td><td className="px-5 py-3">{q as number}</td><td className="px-5 py-3 font-medium">{brl(v as number)}</td><td className="px-5 py-3">{brl(t as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold text-silver-900">{title}</h2>
      {children}
    </div>
  )
}

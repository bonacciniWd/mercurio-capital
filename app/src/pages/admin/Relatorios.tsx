import { brl } from '@/lib/utils'
import { Download, FileSpreadsheet } from 'lucide-react'
import { KPICard } from '@/components/KPICard'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'

const monthly = [
  { m: 'Jan', volume: 28, propostas: 18 }, { m: 'Fev', volume: 32, propostas: 21 },
  { m: 'Mar', volume: 41, propostas: 28 }, { m: 'Abr', volume: 48, propostas: 32 },
  { m: 'Mai', volume: 55, propostas: 38 }, { m: 'Jun', volume: 62, propostas: 44 },
  { m: 'Jul', volume: 68, propostas: 49 }, { m: 'Ago', volume: 71, propostas: 52 },
  { m: 'Set', volume: 78, propostas: 58 }, { m: 'Out', volume: 84, propostas: 63 },
  { m: 'Nov', volume: 91, propostas: 68 }, { m: 'Dez', volume: 98, propostas: 74 },
]
const produtos = [
  { name: 'Home Equity', value: 48, fill: '#0A2B4E' },
  { name: 'Construção', value: 27, fill: '#D4AF37' },
  { name: 'Financiamento', value: 25, fill: '#2C6B9E' },
]
const ranking = [
  { p: 'Aurora', v: 4200 }, { p: 'Vista Sul', v: 2800 }, { p: 'Valor Imob.', v: 3100 },
  { p: 'Norte Crédito', v: 1900 }, { p: 'Capital +', v: 1500 },
]
const funil = [
  { etapa: 'Pré-análise', q: 312 }, { etapa: 'Crédito', q: 248 }, { etapa: 'Jurídica', q: 184 },
  { etapa: 'Comitê', q: 128 }, { etapa: 'Assinatura', q: 96 }, { etapa: 'Liberada', q: 78 },
]

export function AdminRelatorios() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Relatórios</h1>
          <p className="text-sm text-silver-600">Análise consolidada da operação.</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto"><option>Últimos 12 meses</option><option>YTD</option><option>Trimestre</option></select>
          <button className="btn-outline"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <button className="btn-gold"><Download className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Volume YTD" value={brl(75600000000)} intent="gold" />
        <KPICard label="Propostas YTD" value="545" intent="success" />
        <KPICard label="Ticket médio" value={brl(13900000)} />
        <KPICard label="Taxa de conversão" value="25%" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-silver-900">Volume mensal (R$ milhões) × Propostas</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis dataKey="m" stroke="#9CA3AF" fontSize={12} />
              <YAxis yAxisId="l" stroke="#0A2B4E" fontSize={12} />
              <YAxis yAxisId="r" orientation="right" stroke="#D4AF37" fontSize={12} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="l" type="monotone" dataKey="volume" stroke="#0A2B4E" strokeWidth={2.5} name="Volume (Mi)" />
              <Line yAxisId="r" type="monotone" dataKey="propostas" stroke="#D4AF37" strokeWidth={2.5} name="Propostas" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-silver-900">Distribuição por produto</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={produtos} dataKey="value" nameKey="name" outerRadius={100} label={(e: { name: string; value: number }) => `${e.name} ${e.value}%`}>
                {produtos.map((p, i) => <Cell key={i} fill={p.fill} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-silver-900">Top 5 parceiros (volume R$ Mi)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ranking} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis type="number" stroke="#9CA3AF" fontSize={11} />
              <YAxis type="category" dataKey="p" stroke="#9CA3AF" fontSize={11} width={90} />
              <Tooltip />
              <Bar dataKey="v" fill="#D4AF37" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-silver-900">Funil de conversão</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funil}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis dataKey="etapa" stroke="#9CA3AF" fontSize={11} />
              <YAxis stroke="#9CA3AF" fontSize={11} />
              <Tooltip />
              <Bar dataKey="q" fill="#2C6B9E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-4 py-3">Parceiro</th><th className="px-4 py-3 text-right">Propostas</th>
              <th className="px-4 py-3 text-right">Aprovadas</th><th className="px-4 py-3 text-right">Volume</th>
              <th className="px-4 py-3 text-right">Ticket médio</th><th className="px-4 py-3 text-right">Conversão</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Aurora', 47, 32, 4200000000, 131000000, 68],
              ['Vista Sul', 38, 24, 2800000000, 117000000, 63],
              ['Valor Imobiliário', 29, 19, 3100000000, 163000000, 65],
              ['Norte Crédito', 22, 14, 1900000000, 136000000, 64],
              ['Capital +', 18, 9, 1500000000, 167000000, 50],
            ].map((r, i) => (
              <tr key={i} className="border-t border-silver-100">
                <td className="px-4 py-3 font-medium">{r[0]}</td>
                <td className="px-4 py-3 text-right">{r[1]}</td>
                <td className="px-4 py-3 text-right text-success font-medium">{r[2]}</td>
                <td className="px-4 py-3 text-right font-bold text-navy">{brl(r[3] as number)}</td>
                <td className="px-4 py-3 text-right">{brl(r[4] as number)}</td>
                <td className="px-4 py-3 text-right">{r[5]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

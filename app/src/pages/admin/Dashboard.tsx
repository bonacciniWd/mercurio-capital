import { brl } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const monthly = [
  { m: 'Jan', he: 12, cc: 5, fi: 8 }, { m: 'Fev', he: 14, cc: 7, fi: 9 }, { m: 'Mar', he: 18, cc: 8, fi: 11 },
  { m: 'Abr', he: 22, cc: 10, fi: 12 }, { m: 'Mai', he: 25, cc: 13, fi: 14 }, { m: 'Jun', he: 28, cc: 14, fi: 16 },
  { m: 'Jul', he: 30, cc: 16, fi: 18 }, { m: 'Ago', he: 32, cc: 17, fi: 20 }, { m: 'Set', he: 36, cc: 19, fi: 22 },
  { m: 'Out', he: 41, cc: 21, fi: 24 }, { m: 'Nov', he: 44, cc: 23, fi: 26 }, { m: 'Dez', he: 48, cc: 25, fi: 27 },
]
const bottlenecks = [
  { stage: 'Análise Jurídica', count: 32 },
  { stage: 'Comitê', count: 28 },
  { stage: 'Em Registro', count: 24 },
  { stage: 'Análise Imóvel', count: 18 },
  { stage: 'Aguardando assinatura', count: 14 },
]

export function AdminDashboard() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Dashboard administrativo</h1>

      <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Parceiros ativos" value="47" />
        <KPICard label="Propostas abertas" value="312" />
        <KPICard label="Volume em análise" value={brl(8700000000)} intent="gold" />
        <KPICard label="Contratos do mês" value="23" intent="success" />
        <KPICard label="Docs pendentes" value="41" intent="warning" />
        <KPICard label="Saldo carteiras" value={brl(1850000)} />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-silver-900">Volume de propostas por produto (12 meses)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis dataKey="m" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip />
              <Area type="monotone" dataKey="he" stackId="1" stroke="#0A2B4E" fill="#0A2B4E" />
              <Area type="monotone" dataKey="cc" stackId="1" stroke="#D4AF37" fill="#D4AF37" />
              <Area type="monotone" dataKey="fi" stackId="1" stroke="#2C6B9E" fill="#2C6B9E" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            <Legend color="#0A2B4E" label="Home Equity" />
            <Legend color="#D4AF37" label="Construção" />
            <Legend color="#2C6B9E" label="Financiamento" />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-silver-900">Gargalos por etapa</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bottlenecks} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
              <XAxis type="number" stroke="#9CA3AF" fontSize={11} />
              <YAxis type="category" dataKey="stage" stroke="#9CA3AF" fontSize={11} width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#D9534F" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ListCard title="Aprovações pendentes (top 5)" items={[
          ['Construtora Aurora LTDA', '12.345.678/0001-90', '2 dias'],
          ['Imobiliária Vista Sul', '23.456.789/0001-01', '1 dia'],
          ['Capital Mais Crédito', '34.567.890/0001-12', 'há horas'],
          ['Valor Imobiliário', '45.678.901/0001-23', '4 dias'],
          ['Norte Crédito SA', '56.789.012/0001-34', '5 dias'],
        ]} />
        <ListCard title="Documentos pendentes (top 5)" items={[
          ['MC-2024-0042 · João Silva', 'Comprovante de renda', '2 dias'],
          ['MC-2024-0061 · Pedro Lima', 'Matrícula do imóvel', '4 dias'],
          ['MC-2024-0078 · Ana Souza', 'IRPF 2024', '1 dia'],
          ['MC-2024-0083 · Lucas P.', 'Contrato social', '3 dias'],
          ['MC-2024-0091 · Fernanda T.', 'Certidão de casamento', '5 dias'],
        ]} />
      </div>
    </>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>
}
function ListCard({ title, items }: { title: string; items: string[][] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold text-silver-900">{title}</h2>
      <ul className="divide-y divide-silver-100">
        {items.map((row, i) => (
          <li key={i} className="flex items-center justify-between py-2.5 text-sm">
            <div>
              <p className="font-medium text-silver-900">{row[0]}</p>
              <p className="text-xs text-silver-500">{row[1]}</p>
            </div>
            <span className="text-xs text-warning">{row[2]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

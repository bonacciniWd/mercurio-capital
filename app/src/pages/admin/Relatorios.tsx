import { brl } from '@/lib/utils'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { KPICard } from '@/components/KPICard'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Construção',
  financiamento_imobiliario: 'Financiamento',
}

const PRODUTO_COLORS: Record<string, string> = {
  home_equity: '#0A2B4E',
  credito_construcao: '#D4AF37',
  financiamento_imobiliario: '#2C6B9E',
}

// Etapas agregadas do funil (admin)
const FUNIL_STAGES: { label: string; matches: string[] }[] = [
  { label: 'Pré-análise', matches: ['pre_analise'] },
  { label: 'Crédito', matches: ['analise_credito'] },
  { label: 'Jurídica', matches: ['analise_juridica'] },
  { label: 'Comitê', matches: ['comite'] },
  { label: 'Assinatura', matches: ['aguardando_assinatura', 'em_registro'] },
  { label: 'Liberada', matches: ['contrato_registrado', 'recurso_liberado'] },
]

interface KpiRow {
  total_propostas: number
  propostas_mes: number
  ativas: number
  ganhas: number
  canceladas: number
  taxa_conversao: number
  volume_ganho: number
  volume_total: number
  parceiros_ativos: number
}
interface TopRow { partner_id: string; partner_nome: string; total: number; ganhas: number; volume: number }
interface FunilRow { partner_id: string; status: string; quantidade: number; volume: number }
interface MesRow { partner_id: string; mes: string; quantidade: number; ganhas: number; volume: number }
interface PropostaRow { produto: string; valor_solicitado: number }

export function AdminRelatorios() {
  const [periodo, setPeriodo] = useState<'12m' | 'ytd' | 'trimestre'>('12m')

  const kpiQuery = useQuery({
    queryKey: ['admin-rel-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_dashboard_kpis')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })

  const topQuery = useQuery({
    queryKey: ['admin-rel-top'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_top_partners')
        .select('partner_id, partner_nome, total, ganhas, volume')
      if (error) throw error
      return (data ?? []) as TopRow[]
    },
  })

  const funilQuery = useQuery({
    queryKey: ['admin-rel-funil'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_funil_status')
        .select('partner_id, status, quantidade, volume')
      if (error) throw error
      return (data ?? []) as FunilRow[]
    },
  })

  const mesQuery = useQuery({
    queryKey: ['admin-rel-mes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_propostas_por_mes')
        .select('partner_id, mes, quantidade, ganhas, volume')
        .order('mes')
      if (error) throw error
      return (data ?? []) as MesRow[]
    },
  })

  const propostasQuery = useQuery({
    queryKey: ['admin-rel-propostas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('produto, valor_solicitado')
        .limit(20000)
      if (error) throw error
      return (data ?? []) as PropostaRow[]
    },
  })

  const kpi = kpiQuery.data

  // Volume mensal × propostas: agregar por mês, filtrar pelo período
  const monthly = useMemo(() => {
    const rows = mesQuery.data ?? []
    const map = new Map<string, { volume: number; propostas: number }>()
    const now = new Date()
    const start = (() => {
      if (periodo === 'ytd') return new Date(now.getFullYear(), 0, 1)
      if (periodo === 'trimestre') {
        const d = new Date(now); d.setMonth(d.getMonth() - 3); return d
      }
      const d = new Date(now); d.setMonth(d.getMonth() - 12); return d
    })()
    rows.forEach(r => {
      const d = new Date(r.mes)
      if (d < start) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = map.get(key) ?? { volume: 0, propostas: 0 }
      cur.volume += Number(r.volume) || 0
      cur.propostas += r.quantidade
      map.set(key, cur)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [yy, mm] = key.split('-')
        const d = new Date(Number(yy), Number(mm) - 1, 1)
        return {
          m: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          volume: Math.round(v.volume / 1_000_000), // milhões de reais
          propostas: v.propostas,
        }
      })
  }, [mesQuery.data, periodo])

  // Distribuição por produto
  const produtos = useMemo(() => {
    const rows = propostasQuery.data ?? []
    const counts = new Map<string, number>()
    rows.forEach(r => counts.set(r.produto, (counts.get(r.produto) ?? 0) + 1))
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
    return Array.from(counts.entries()).map(([k, v]) => ({
      name: PRODUTO_LABEL[k] ?? k,
      value: Math.round((v / total) * 100),
      fill: PRODUTO_COLORS[k] ?? '#9CA3AF',
    }))
  }, [propostasQuery.data])

  // Top 5 parceiros (volume em milhões)
  const ranking = useMemo(() => {
    return (topQuery.data ?? [])
      .slice(0, 5)
      .map(t => ({ p: t.partner_nome, v: Math.round(Number(t.volume) / 1_000_000) }))
  }, [topQuery.data])

  // Funil agregado global
  const funil = useMemo(() => {
    const rows = funilQuery.data ?? []
    return FUNIL_STAGES.map(s => ({
      etapa: s.label,
      q: rows.filter(r => s.matches.includes(r.status)).reduce((a, b) => a + b.quantidade, 0),
    }))
  }, [funilQuery.data])

  // Tabela de parceiros
  const partnersTable = useMemo(() => {
    return (topQuery.data ?? []).slice(0, 20).map(t => ({
      nome: t.partner_nome,
      propostas: t.total,
      aprovadas: t.ganhas,
      volume: Number(t.volume),
      ticket: t.ganhas > 0 ? Number(t.volume) / t.ganhas : 0,
      conversao: t.total > 0 ? Math.round((t.ganhas / t.total) * 100) : 0,
    }))
  }, [topQuery.data])

  const loading = kpiQuery.isLoading || topQuery.isLoading || funilQuery.isLoading || mesQuery.isLoading || propostasQuery.isLoading

  const ticketMedio = kpi && kpi.ganhas > 0 ? Number(kpi.volume_ganho) / kpi.ganhas : 0

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Relatórios</h1>
          <p className="text-sm text-silver-600">Análise consolidada da operação.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="input w-auto"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as '12m' | 'ytd' | 'trimestre')}
          >
            <option value="12m">Últimos 12 meses</option>
            <option value="ytd">YTD</option>
            <option value="trimestre">Trimestre</option>
          </select>
          <button className="btn-outline" disabled><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <button className="btn-gold" disabled><Download className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <KPICard label="Volume ganho" value={brl(Number(kpi?.volume_ganho ?? 0) * 100)} intent="gold" />
            <KPICard label="Propostas (mês)" value={String(kpi?.propostas_mes ?? 0)} intent="success" />
            <KPICard label="Ticket médio" value={brl(ticketMedio * 100)} />
            <KPICard label="Taxa de conversão" value={`${kpi?.taxa_conversao ?? 0}%`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-silver-900">Volume mensal (R$ milhões) × Propostas</h2>
              {monthly.length === 0 ? (
                <EmptyChart />
              ) : (
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
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-silver-900">Distribuição por produto</h2>
              {produtos.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={produtos} dataKey="value" nameKey="name" outerRadius={100} label={(e: { name: string; value: number }) => `${e.name} ${e.value}%`}>
                      {produtos.map((p, i) => <Cell key={i} fill={p.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-silver-900">Top 5 parceiros (volume R$ Mi)</h2>
              {ranking.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ranking} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={11} />
                    <YAxis type="category" dataKey="p" stroke="#9CA3AF" fontSize={11} width={120} />
                    <Tooltip />
                    <Bar dataKey="v" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-silver-900">Funil de conversão</h2>
              {funil.every(f => f.q === 0) ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funil}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
                    <XAxis dataKey="etapa" stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="q" fill="#2C6B9E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
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
                {partnersTable.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-silver-400">Sem dados.</td></tr>
                ) : partnersTable.map((r) => (
                  <tr key={r.nome} className="border-t border-silver-100">
                    <td className="px-4 py-3 font-medium">{r.nome}</td>
                    <td className="px-4 py-3 text-right">{r.propostas}</td>
                    <td className="px-4 py-3 text-right text-success font-medium">{r.aprovadas}</td>
                    <td className="px-4 py-3 text-right font-bold text-navy">{brl(r.volume * 100)}</td>
                    <td className="px-4 py-3 text-right">{brl(r.ticket * 100)}</td>
                    <td className="px-4 py-3 text-right">{r.conversao}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function EmptyChart({ label = 'Sem dados.' }: { label?: string }) {
  return <p className="py-16 text-center text-sm text-silver-400">{label}</p>
}


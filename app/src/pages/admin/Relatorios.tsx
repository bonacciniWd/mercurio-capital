import { brl } from '@/lib/utils'
import { ChevronDown, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { KPICard } from '@/components/KPICard'
import { DateRangePicker } from '@/components/ui/date-range-picker'
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
  home_equity: '#D10000',
  credito_construcao: '#3A3A3A',
  financiamento_imobiliario: '#98A3AF',
}

// Etapas agregadas do funil (admin)
const FUNIL_STAGES: { label: string; matches: string[] }[] = [
  { label: 'Pré-análise', matches: ['pre_analise'] },
  { label: 'Crédito', matches: ['analise_credito'] },
  { label: 'Pré-aprovado', matches: ['pre_aprovado'] },
  { label: 'Jurídica', matches: ['analise_juridica'] },
  { label: 'Comitê', matches: ['comite'] },
  { label: 'Assinatura', matches: ['aguardando_assinatura', 'em_registro'] },
  { label: 'Liberada', matches: ['contrato_registrado', 'recurso_liberado'] },
]

interface Analytics {
  total_propostas: number
  ativas: number
  ganhas: number
  taxa_conversao: number
  volume_ganho: number
  volume_total: number
  serie: Array<{ periodo: string; propostas: number; ganhas: number; volume_solicitado: number; volume_ganho: number }>
  top_parceiros: Array<{ partner_id: string; partner_nome: string; total: number; ganhas: number; volume_ganho: number }>
}
interface PropostaRow { produto: string; status: string; valor_solicitado: number }

export function AdminRelatorios() {
  const [periodo, setPeriodo] = useState<'12m' | 'ytd' | 'trimestre'>('12m')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  const range = useMemo(() => {
    const now = new Date()
    if (rangeFrom || rangeTo) {
      return { inicio: rangeFrom || rangeTo, fim: rangeTo || rangeFrom }
    }
    if (periodo === 'ytd') return { inicio: `${now.getFullYear()}-01-01`, fim: now.toISOString().slice(0, 10) }
    if (periodo === 'trimestre') {
      const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return { inicio: start.toISOString().slice(0, 10), fim: now.toISOString().slice(0, 10) }
    }
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    return { inicio: start.toISOString().slice(0, 10), fim: now.toISOString().slice(0, 10) }
  }, [periodo, rangeFrom, rangeTo])

  const analyticsQuery = useQuery({
    queryKey: ['admin-rel-analytics', range.inicio, range.fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard_analytics', {
        p_inicio: range.inicio, p_fim: range.fim, p_fundo: null, p_partner: null, p_equipe: null,
      })
      if (error) throw error
      return data as Analytics
    },
  })

  const propostasQuery = useQuery({
    queryKey: ['admin-rel-propostas', range.inicio, range.fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('produto, status, valor_solicitado')
        .gte('created_at', `${range.inicio}T00:00:00-03:00`)
        .lt('created_at', `${range.fim}T23:59:59.999-03:00`)
        .limit(20000)
      if (error) throw error
      return (data ?? []) as PropostaRow[]
    },
  })

  const analytics = analyticsQuery.data

  // Volume mensal × propostas: agregar por mês, filtrar pelo período
  const monthly = useMemo(() => {
    return (analytics?.serie ?? []).map(row => ({
      m: new Date(`${row.periodo}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      volume: Math.round(Number(row.volume_solicitado) / 1_000_000),
      propostas: Number(row.propostas),
    }))
  }, [analytics?.serie])

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
    return (analytics?.top_parceiros ?? [])
      .slice(0, 5)
      .map(t => ({ p: t.partner_nome, v: Math.round(Number(t.volume_ganho) / 1_000_000) }))
  }, [analytics?.top_parceiros])

  // Funil agregado global
  const funil = useMemo(() => {
    const rows = propostasQuery.data ?? []
    return FUNIL_STAGES.map(s => ({
      etapa: s.label,
      q: rows.filter(r => s.matches.includes(r.status)).length,
    }))
  }, [propostasQuery.data])

  // Tabela de parceiros
  const partnersTable = useMemo(() => {
    return (analytics?.top_parceiros ?? []).slice(0, 20).map(t => ({
      nome: t.partner_nome,
      propostas: t.total,
      aprovadas: t.ganhas,
      volume: Number(t.volume_ganho),
      ticket: t.ganhas > 0 ? Number(t.volume_ganho) / t.ganhas : 0,
      conversao: t.total > 0 ? Math.round((t.ganhas / t.total) * 100) : 0,
    }))
  }, [analytics?.top_parceiros])

  const loading = analyticsQuery.isLoading || propostasQuery.isLoading

  const ticketMedio = analytics && analytics.ganhas > 0 ? Number(analytics.volume_ganho) / analytics.ganhas : 0

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Relatórios</h1>
          <p className="text-sm text-silver-600">Análise consolidada da operação.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="relative inline-flex items-center">
            <span className="sr-only">Período do relatório</span>
            <select
              className="h-10 w-[170px] appearance-none rounded-lg border border-navy/20 bg-white px-3 pr-9 text-sm font-semibold text-navy shadow-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15 disabled:cursor-not-allowed disabled:bg-silver-50 disabled:text-silver-400"
              value={periodo}
              disabled={Boolean(rangeFrom || rangeTo)}
              onChange={(e) => setPeriodo(e.target.value as '12m' | 'ytd' | 'trimestre')}
            >
              <option value="12m">Últimos 12 meses</option>
              <option value="ytd">YTD</option>
              <option value="trimestre">Trimestre</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 h-4 w-4 text-navy" />
          </label>
          <DateRangePicker
            start={range.inicio}
            end={range.fim}
            onChange={(start, end) => { setRangeFrom(start); setRangeTo(end) }}
          />
          {(rangeFrom || rangeTo) && (
            <button
              type="button"
              className="h-10 rounded-lg px-2 text-xs font-semibold text-silver-600 underline decoration-silver-300 underline-offset-2 transition hover:text-red-700"
              onClick={() => { setRangeFrom(''); setRangeTo('') }}
            >
              Limpar
            </button>
          )}
          <button className="btn-outline h-10 border-silver-300 px-3 text-sm" disabled><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <button className="btn-gold h-10 px-3 text-sm" disabled><Download className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <KPICard label="Volume ganho" value={brl(Number(analytics?.volume_ganho ?? 0) * 100)} intent="gold" />
            <KPICard label="Propostas no período" value={String(analytics?.total_propostas ?? 0)} intent="success" />
            <KPICard label="Ticket médio" value={brl(ticketMedio * 100)} />
            <KPICard label="Taxa de conversão" value={`${analytics?.taxa_conversao ?? 0}%`} />
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
                    <Line yAxisId="l" type="monotone" dataKey="volume" stroke="#D10000" strokeWidth={2.5} name="Volume (Mi)" />
                    <Line yAxisId="r" type="monotone" dataKey="propostas" stroke="#3A3A3A" strokeWidth={2.5} name="Propostas" />
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
                    <Bar dataKey="v" fill="#D10000" radius={[0, 4, 4, 0]} />
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
                    <Bar dataKey="q" fill="#D10000" radius={[4, 4, 0, 0]} />
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

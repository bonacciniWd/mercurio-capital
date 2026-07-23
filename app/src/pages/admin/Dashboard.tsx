import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from 'recharts'
import { Loader2, Users, FileText, TrendingUp, Banknote, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { FunilParceirosCard } from '@/components/FunilParceirosCard'

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

export function AdminDashboard() {
  const kpiQuery = useQuery({
    queryKey: ['admin-kpis'],
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
    queryKey: ['admin-top-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_top_partners')
        .select('partner_id, partner_nome, total, ganhas, volume')
      if (error) throw error
      return (data ?? []) as TopRow[]
    },
  })

  const kpi = kpiQuery.data
  const top = topQuery.data ?? []
  const loading = kpiQuery.isLoading || topQuery.isLoading

  const topChart = top.slice(0, 10).map(t => ({
    name: t.partner_nome,
    volume: Number(t.volume) || 0,
    propostas: t.total,
  }))

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Dashboard global</h1>
        <p className="text-sm text-silver-500">Visão macro da operação Mercurio.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Kpi icon={<FileText className="h-4 w-4" />} label="Propostas no mês" value={String(kpi?.propostas_mes ?? 0)} accent="#0F172A" />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Conversão" value={`${kpi?.taxa_conversao ?? 0}%`} accent="#16A34A" />
            <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Ganhas" value={String(kpi?.ganhas ?? 0)} accent="#0EA5E9" />
            <Kpi icon={<Banknote className="h-4 w-4" />} label="Volume ganho" value={brl(Number(kpi?.volume_ganho ?? 0) * 100)} accent="#DC2626" />
            <Kpi icon={<Users className="h-4 w-4" />} label="Parceiros ativos" value={String(kpi?.parceiros_ativos ?? 0)} accent="#F59E0B" />
          </div>

          <div className="mb-6">
            <FunilParceirosCard />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-navy">Top 10 parceiros · volume</h2>
                <Link to="/admin/parceiros" className="text-xs font-medium text-red-600 hover:underline">Ver todos →</Link>
              </div>
              {topChart.length === 0 ? (
                <p className="py-12 text-center text-sm text-silver-400">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topChart} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={11} width={120} />
                    <Tooltip formatter={(v: number) => brl(v * 100)} />
                    <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                      {topChart.map((_, i) => <Cell key={i} fill="#DC2626" fillOpacity={0.6 + i * 0.04} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-navy">Resumo</h2>
              <ul className="space-y-3 text-sm">
                <Stat label="Total propostas" value={String(kpi?.total_propostas ?? 0)} />
                <Stat label="Ativas" value={String(kpi?.ativas ?? 0)} />
                <Stat label="Canceladas" value={String(kpi?.canceladas ?? 0)} highlight="text-danger" />
                <Stat label="Volume total" value={brl(Number(kpi?.volume_total ?? 0) * 100)} />
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-silver-200 bg-white p-4" style={{ borderTopWidth: 2, borderTopColor: accent }}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-silver-500">{icon} {label}</p>
      <p className="mt-1.5 text-2xl font-bold text-navy">{value}</p>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <li className="flex items-center justify-between border-b border-silver-100 pb-2 last:border-0 last:pb-0">
      <span className="text-silver-600">{label}</span>
      <span className={`font-bold ${highlight ?? 'text-navy'}`}>{value}</span>
    </li>
  )
}

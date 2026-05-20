import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { Plus, AlertTriangle, TrendingUp, FileText, CheckCircle2, Banknote, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { PartnerOnboardingTour } from '@/components/PartnerOnboardingTour'

interface KpiRow {
  partner_id: string
  total_propostas: number
  propostas_mes: number
  propostas_30d: number
  ativas: number
  ganhas: number
  canceladas: number
  taxa_conversao: number
  volume_ganho: number
  ticket_medio_ganho: number
  volume_total: number
}
interface FunilRow { partner_id: string; status: string; quantidade: number; volume: number }
interface MesRow { partner_id: string; mes: string; quantidade: number; ganhas: number; volume: number }
interface GargaloRow { id: string; protocolo: string; status: string; valor_solicitado: number; dias_parada: number; cliente_nome: string; updated_at: string }

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise crédito',
  analise_imovel: 'Análise imóvel',
  analise_juridica: 'Análise jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Proposta cliente',
  resolucao_pendencias: 'Pendências',
  emissao_contrato: 'Emissão contrato',
  aguardando_assinatura: 'Aguard. assinatura',
  em_registro: 'Em registro',
  contrato_registrado: 'Registrado',
  recurso_liberado: 'Liberado',
  cancelado: 'Cancelado',
}

const FUNIL_ORDER = [
  'pre_analise', 'analise_credito', 'analise_imovel', 'analise_juridica',
  'comite', 'proposta_cliente', 'emissao_contrato', 'aguardando_assinatura',
  'em_registro', 'contrato_registrado', 'recurso_liberado',
]

export function PartnerDashboard() {
  const kpiQuery = useQuery({
    queryKey: ['p-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_dashboard_kpis')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })

  const funilQuery = useQuery({
    queryKey: ['p-funil'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_funil_status')
        .select('partner_id, status, quantidade, volume')
      if (error) throw error
      return (data ?? []) as FunilRow[]
    },
  })

  const mesQuery = useQuery({
    queryKey: ['p-por-mes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_propostas_por_mes')
        .select('partner_id, mes, quantidade, ganhas, volume')
        .order('mes')
      if (error) throw error
      return (data ?? []) as MesRow[]
    },
  })

  const gargalosQuery = useQuery({
    queryKey: ['p-gargalos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_gargalos')
        .select('id, protocolo, status, valor_solicitado, dias_parada, cliente_nome, updated_at')
        .order('dias_parada', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as GargaloRow[]
    },
  })

  const kpi = kpiQuery.data
  const funil = (funilQuery.data ?? [])
    .filter(f => FUNIL_ORDER.includes(f.status))
    .sort((a, b) => FUNIL_ORDER.indexOf(a.status) - FUNIL_ORDER.indexOf(b.status))
    .map(f => ({ name: STATUS_LABEL[f.status] || f.status, value: f.quantidade, volume: f.volume }))

  const mesGrafico = (mesQuery.data ?? []).map(m => ({
    mes: new Date(m.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    propostas: m.quantidade,
    ganhas: m.ganhas,
  }))

  const loading = kpiQuery.isLoading || funilQuery.isLoading

  return (
    <>
      <PartnerOnboardingTour />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-sm text-silver-500">Visão geral das operações da sua carteira.</p>
        </div>
        <Link to="/p/propostas/nova" className="btn-gold"><Plus className="h-4 w-4" /> Nova proposta</Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Kpi icon={<FileText className="h-4 w-4" />} label="Propostas no mês" value={String(kpi?.propostas_mes ?? 0)} accent="#0F172A" />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Taxa de conversão" value={`${kpi?.taxa_conversao ?? 0}%`} accent="#16A34A" />
            <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Ganhas (acumulado)" value={String(kpi?.ganhas ?? 0)} accent="#0EA5E9" />
            <Kpi icon={<Banknote className="h-4 w-4" />} label="Volume ganho" value={brl(Number(kpi?.volume_ganho ?? 0) * 100)} accent="#DC2626" />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-navy">Funil por status</h2>
                <span className="text-xs text-silver-500">Snapshot</span>
              </div>
              {funil.length === 0 ? (
                <p className="py-12 text-center text-sm text-silver-400">Sem propostas ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funil} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} interval={0} angle={-25} textAnchor="end" height={70} />
                    <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {funil.map((_, i) => <Cell key={i} fill={i >= funil.length - 2 ? '#16A34A' : '#0F172A'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-navy">Resumo</h2>
              <ul className="space-y-3 text-sm">
                <Stat label="Total acumulado" value={String(kpi?.total_propostas ?? 0)} />
                <Stat label="Ativas" value={String(kpi?.ativas ?? 0)} />
                <Stat label="Canceladas" value={String(kpi?.canceladas ?? 0)} highlight="text-danger" />
                <Stat label="Ticket médio ganho" value={brl(Number(kpi?.ticket_medio_ganho ?? 0) * 100)} />
                <Stat label="Volume total" value={brl(Number(kpi?.volume_total ?? 0) * 100)} />
              </ul>
            </div>
          </div>

          {mesGrafico.length > 0 && (
            <div className="card mb-6 p-5">
              <h2 className="mb-4 font-semibold text-navy">Evolução (12 meses)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mesGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="propostas" stroke="#0F172A" strokeWidth={2} />
                  <Line type="monotone" dataKey="ganhas" stroke="#16A34A" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-navy">Gargalos (propostas paradas há +7 dias)</h2>
              <Link to="/p/propostas" className="text-xs font-medium text-gold-600 hover:underline">Ver todas →</Link>
            </div>
            {(gargalosQuery.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-silver-400">Sem gargalos. Tudo fluindo.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-silver-500">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">Parada há</th>
                  </tr>
                </thead>
                <tbody>
                  {(gargalosQuery.data ?? []).map(g => (
                    <tr key={g.id} className="border-t border-silver-100 hover:bg-silver-50">
                      <td className="px-3 py-2">
                        <Link to={`/p/propostas/${g.id}`} className="font-medium text-navy hover:underline">{g.cliente_nome}</Link>
                        <p className="font-mono text-xs text-silver-500">{g.protocolo}</p>
                      </td>
                      <td className="px-3 py-2 text-silver-700">{STATUS_LABEL[g.status] ?? g.status}</td>
                      <td className="px-3 py-2 font-medium text-navy">{brl(Number(g.valor_solicitado) * 100)}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" /> {g.dias_parada}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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

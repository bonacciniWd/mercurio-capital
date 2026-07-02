import { brl } from '@/lib/utils'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Download, FileText, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Construção',
  financiamento_imobiliario: 'Financiamento',
}

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

// Funil agregado: do mais amplo para o mais restrito
const FUNIL_STAGES: { key: string; label: string; matches: string[] }[] = [
  { key: 'simulacoes', label: 'Simulações', matches: ['simulacao', 'pre_analise', 'analise_credito', 'analise_imovel', 'analise_juridica', 'comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'pre_analise', label: 'Pré-análise', matches: ['pre_analise', 'analise_credito', 'analise_imovel', 'analise_juridica', 'comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'analise', label: 'Análise', matches: ['analise_credito', 'analise_imovel', 'analise_juridica', 'comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'comite', label: 'Comitê', matches: ['comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'contrato', label: 'Contrato', matches: ['emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
]

const STATUS_TABLE_ORDER = ['pre_analise', 'analise_credito', 'analise_imovel', 'analise_juridica', 'comite', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado']

const colors = ['#0A2B4E', '#D4AF37', '#2C6B9E', '#10B981', '#DC2626']

interface FunilRow { status: string; quantidade: number; volume: number }
interface MesRow { mes: string; quantidade: number; volume: number }
interface PropostaProdutoRow { produto: string; valor_solicitado: number; responsavel_id: string | null }
interface MembroRow { usuario_id: string; nome_completo: string }

export function PartnerRelatorios() {
  const [exporting, setExporting] = useState(false)

  const funilQuery = useQuery({
    queryKey: ['p-rel-funil'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_funil_status')
        .select('status, quantidade, volume')
      if (error) throw error
      return (data ?? []) as FunilRow[]
    },
  })

  const mesQuery = useQuery({
    queryKey: ['p-rel-mes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_propostas_por_mes')
        .select('mes, quantidade, volume')
        .order('mes')
      if (error) throw error
      return (data ?? []) as MesRow[]
    },
  })

  const propostasQuery = useQuery({
    queryKey: ['p-rel-propostas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('produto, valor_solicitado, responsavel_id')
        .limit(5000)
      if (error) throw error
      return (data ?? []) as PropostaProdutoRow[]
    },
  })

  const membrosQuery = useQuery({
    queryKey: ['p-rel-membros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_membros_detalhe')
        .select('usuario_id, nome_completo')
      if (error) throw error
      return (data ?? []) as MembroRow[]
    },
  })

  const funnel = useMemo(() => {
    const rows = funilQuery.data ?? []
    const countByStatus = new Map(rows.map(r => [r.status, r.quantidade]))
    return FUNIL_STAGES.map(s => ({
      stage: s.label,
      count: s.matches.reduce((acc, st) => acc + (countByStatus.get(st) ?? 0), 0),
    }))
  }, [funilQuery.data])

  const monthly = useMemo(() => {
    return (mesQuery.data ?? []).map(m => ({
      m: new Date(m.mes).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      v: m.quantidade,
    }))
  }, [mesQuery.data])

  const products = useMemo(() => {
    const rows = propostasQuery.data ?? []
    const counts = new Map<string, number>()
    rows.forEach(r => counts.set(r.produto, (counts.get(r.produto) ?? 0) + 1))
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
    return Array.from(counts.entries()).map(([k, v]) => ({
      name: PRODUTO_LABEL[k] ?? k,
      value: Math.round((v / total) * 100),
    }))
  }, [propostasQuery.data])

  const team = useMemo(() => {
    const rows = propostasQuery.data ?? []
    const nomes = new Map((membrosQuery.data ?? []).map(m => [m.usuario_id, m.nome_completo]))
    const counts = new Map<string, number>()
    rows.forEach(r => {
      if (!r.responsavel_id) return
      counts.set(r.responsavel_id, (counts.get(r.responsavel_id) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([id, count]) => ({ name: (nomes.get(id) ?? '—').split(' ')[0], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [propostasQuery.data, membrosQuery.data])

  const statusTable = useMemo(() => {
    const rows = funilQuery.data ?? []
    const byStatus = new Map(rows.map(r => [r.status, r]))
    return STATUS_TABLE_ORDER
      .map(st => {
        const r = byStatus.get(st)
        const q = r?.quantidade ?? 0
        const v = Number(r?.volume ?? 0)
        return { status: STATUS_LABEL[st] ?? st, q, v, t: q > 0 ? v / q : 0 }
      })
      .filter(r => r.q > 0)
  }, [funilQuery.data])

  const loading = funilQuery.isLoading || mesQuery.isLoading || propostasQuery.isLoading

  async function exportar() {
    try {
      setExporting(true)
      const { data, error } = await supabase.functions.invoke('relatorios-exportar', {
        body: { tipo: 'propostas', filtros: {} },
      })

      if (error) {
        let message = error.message || 'Falha ao exportar'
        try {
          const ctx = (error as { context?: Response }).context
          if (ctx && typeof ctx.text === 'function') {
            const text = await ctx.text()
            if (text) message = text
          }
        } catch {
          /* ignore */
        }
        throw new Error(message)
      }

      const blob = data instanceof Blob
        ? data
        : new Blob([typeof data === 'string' ? data : JSON.stringify(data)], {
          type: 'text/csv;charset=utf-8',
        })

      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `propostas_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao exportar')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-navy">Relatórios</h1>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={exportar} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
          </button>
          <button className="btn-outline" disabled><FileText className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Funil de conversão">
              {funnel.every(f => f.count === 0) ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={funnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" stroke="#9CA3AF" fontSize={12} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2C6B9E" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Volume mensal (qtde propostas)">
              {monthly.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
                    <XAxis dataKey="m" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="v" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#0A2B4E', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Por produto (%)">
              {products.length === 0 ? (
                <EmptyChart />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={products} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                        {products.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-center gap-4 text-xs">
                    {products.map((p, i) => (
                      <span key={p.name} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i % colors.length] }} /> {p.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>

            <ChartCard title="Performance por colaborador">
              {team.length === 0 ? (
                <EmptyChart label="Sem propostas com responsável atribuído." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={team}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0A2B4E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="card mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr><th className="px-5 py-3">Status</th><th className="px-5 py-3">Quantidade</th><th className="px-5 py-3">Volume</th><th className="px-5 py-3">Ticket médio</th></tr>
              </thead>
              <tbody>
                {statusTable.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-silver-400">Sem propostas.</td></tr>
                ) : statusTable.map(r => (
                  <tr key={r.status} className="border-t border-silver-100">
                    <td className="px-5 py-3">{r.status}</td>
                    <td className="px-5 py-3">{r.q}</td>
                    <td className="px-5 py-3 font-medium">{brl(r.v * 100)}</td>
                    <td className="px-5 py-3">{brl(r.t * 100)}</td>
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold text-silver-900">{title}</h2>
      {children}
    </div>
  )
}

function EmptyChart({ label = 'Sem dados.' }: { label?: string }) {
  return <p className="py-16 text-center text-sm text-silver-400">{label}</p>
}


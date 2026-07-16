import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Eye, Loader2, Download, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { calcularLTV } from '@/lib/credito'
import { PROPOSTA_STATUS_LABEL } from '@/lib/propostaStatus'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Construção',
  financiamento_imobiliario: 'Financiamento',
}

const STATUS_FINAIS = new Set(['contrato_registrado', 'completo', 'cancelado'])

type RpcRow = {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  created_at: string
  updated_at: string
  partner_id: string | null
  partner_nome: string | null
  cliente_id: string | null
  cliente_nome: string | null
  cliente_cpf: string | null
}

type Row = {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  created_at: string
  updated_at: string
  partner: { usuario: { nome_completo: string | null } | null } | null
  cliente: { nome_completo: string; cpf: string | null } | null
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function AdminPropostas() {
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState<string>('all')
  const [produtoF, setProdutoF] = useState<string>('all')

  const { data: propostas, isLoading } = useQuery({
    queryKey: ['admin-propostas'],
    queryFn: async (): Promise<Row[]> => {
      // RPC SECURITY DEFINER: retorna propostas do admin E de todos os parceiros.
      // Evita depender do RLS nas tabelas filhas (partners/usuarios/clientes).
      const { data, error } = await supabase.rpc('admin_list_propostas', { p_limit: 500 })
      if (error) throw error
      return ((data || []) as RpcRow[]).map((r) => ({
        id: r.id,
        protocolo: r.protocolo,
        produto: r.produto,
        status: r.status,
        valor_solicitado: Number(r.valor_solicitado || 0),
        valor_imoveis_total: Number(r.valor_imoveis_total || 0),
        prazo_meses: r.prazo_meses,
        created_at: r.created_at,
        updated_at: r.updated_at,
        partner: r.partner_id
          ? { usuario: { nome_completo: r.partner_nome } }
          : null,
        cliente: r.cliente_id
          ? { nome_completo: r.cliente_nome || '', cpf: r.cliente_cpf }
          : null,
      }))
    },
  })

  const filtradas = useMemo(() => {
    if (!propostas) return []
    const term = q.trim().toLowerCase()
    return propostas.filter((p) => {
      if (statusF !== 'all' && p.status !== statusF) return false
      if (produtoF !== 'all' && p.produto !== produtoF) return false
      if (!term) return true
      const haystack = [
        p.protocolo,
        p.cliente?.nome_completo,
        p.cliente?.cpf,
        p.partner?.usuario?.nome_completo,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [propostas, q, statusF, produtoF])

  const kpis = useMemo(() => {
    const ativas = (propostas || []).filter((p) => !STATUS_FINAIS.has(p.status))
    const volume = ativas.reduce((sum, p) => sum + Number(p.valor_solicitado || 0), 0)
    const ltvs = ativas
      .map((p) => calcularLTV(Number(p.valor_solicitado || 0), Number(p.valor_imoveis_total || 0)))
      .filter((v) => Number.isFinite(v) && v > 0)
    const ltvMedio = ltvs.length ? ltvs.reduce((a, b) => a + b, 0) / ltvs.length : 0
    const tempoMedio = ativas.length
      ? ativas.reduce((s, p) => s + diasDesde(p.created_at), 0) / ativas.length
      : 0
    return {
      total: ativas.length,
      volume,
      ltv: ltvMedio,
      tempo: tempoMedio,
    }
  }, [propostas])

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Propostas — visão geral</h1>
          <p className="text-sm text-silver-600">Lista completa em todas as etapas.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/propostas/nova" className="btn-gold inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova proposta
          </Link>
          <Link to="/admin/kanban" className="btn-outline">Ver Kanban</Link>
          <button className="btn-gold inline-flex items-center gap-2" disabled>
            <Download className="h-4 w-4" /> Exportar
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Ativas" value={kpis.total.toString()} />
        <KPICard label="Volume em análise" value={brl(kpis.volume * 100)} intent="gold" />
        <KPICard label="LTV médio" value={kpis.ltv ? `${Math.round(kpis.ltv * 100)}%` : '—'} />
        <KPICard label="Tempo médio" value={kpis.tempo ? `${Math.round(kpis.tempo)}d` : '—'} intent="warning" />
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input
            className="input pl-9"
            placeholder="Protocolo, CPF, cliente ou parceiro"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">Status: todos</option>
          {Object.entries(PROPOSTA_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="input w-auto" value={produtoF} onChange={(e) => setProdutoF(e.target.value)}>
          <option value="all">Produto: todos</option>
          {Object.entries(PRODUTO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
        ) : !filtradas.length ? (
          <div className="p-10 text-center text-sm text-silver-500">Nenhuma proposta encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">LTV</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Dias</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => {
                const dias = diasDesde(p.created_at)
                const ltv = calcularLTV(Number(p.valor_solicitado || 0), Number(p.valor_imoveis_total || 0))
                const ltvPct = Math.round(ltv * 100)
                return (
                  <tr key={p.id} className="border-t border-silver-100 hover:bg-silver-50">
                    <td className="px-4 py-3 font-mono text-xs text-silver-700">{p.protocolo || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-silver-900">{p.cliente?.nome_completo || '—'}</p>
                      <p className="font-mono text-xs text-silver-500">{p.cliente?.cpf || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-silver-700">
                      {p.partner?.usuario?.nome_completo || '—'}
                    </td>
                    <td className="px-4 py-3 text-silver-700">{PRODUTO_LABEL[p.produto] || p.produto}</td>
                    <td className="px-4 py-3 text-right font-bold text-navy">{brl(Number(p.valor_solicitado) * 100)}</td>
                    <td className="px-4 py-3 text-right">
                      {ltv > 0 ? (
                        <span className={`badge ${ltvPct > 60 ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{ltvPct}%</span>
                      ) : <span className="text-silver-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-silver-100 px-2 py-0.5 text-xs text-silver-700">
                        {PROPOSTA_STATUS_LABEL[p.status] || p.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right ${dias > 7 ? 'font-semibold text-danger' : 'text-silver-600'}`}>{dias}d</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/propostas/${p.id}`} className="rounded-md p-1.5 hover:bg-silver-100" title="Ver">
                        <Eye className="h-4 w-4 text-silver-600" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

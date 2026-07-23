import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, DollarSign, TrendingUp, CheckCircle2, BadgeCheck, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface FinSummary {
  volume_mes: number | string
  volume_total: number | string
  ticket_medio: number | string
  liberacoes_total: number
  comissoes_previstas: number | string
  comissoes_aprovadas: number | string
  comissoes_pagas: number | string
  comissoes_qtd_prevista: number
  historico_mensal: Array<{ mes: string; qtd: number; volume: number }> | null
}

interface ComissaoRow {
  id: string
  proposta_id: string
  partner_id: string
  percentual: number
  valor: number
  status: 'prevista' | 'aprovada' | 'paga'
  paga_em: string | null
  aprovada_em: string | null
  created_at: string
  observacao: string | null
  partner_nome: string | null
  partner_email: string | null
  protocolo: string | null
}

const cents = (v: number | string) => Math.round(Number(v ?? 0) * 100)

export function AdminFinanceiro() {
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<'prevista' | 'aprovada' | 'paga' | 'todas'>('prevista')

  const sumQuery = useQuery({
    queryKey: ['admin-financeiro-sum'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_financeiro_admin').select('*').single()
      if (error) throw error
      return data as FinSummary
    },
  })

  const comissoesQuery = useQuery({
    queryKey: ['admin-comissoes', statusFiltro],
    queryFn: async () => {
      let q = supabase.from('v_comissoes_admin')
        .select('id, proposta_id, partner_id, percentual, valor, status, paga_em, aprovada_em, created_at, observacao, partner_nome, partner_email, protocolo')
        .order('created_at', { ascending: false })
        .limit(200)
      if (statusFiltro !== 'todas') q = q.eq('status', statusFiltro)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ComissaoRow[]
    },
  })

  const aprovarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('comissao_aprovar', { p_comissao_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-comissoes'] })
      void qc.invalidateQueries({ queryKey: ['admin-financeiro-sum'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const pagarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('comissao_marcar_paga', { p_comissao_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-comissoes'] })
      void qc.invalidateQueries({ queryKey: ['admin-financeiro-sum'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const sum = sumQuery.data
  const comissoes = comissoesQuery.data ?? []

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Financeiro</h1>
        <p className="text-sm text-silver-500">Volume de liberações e comissões dos parceiros.</p>
      </div>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4" /> {erro}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Volume liberado (mês)" value={sum ? brl(cents(sum.volume_mes)) : '—'} />
        <Kpi icon={TrendingUp} label="Ticket médio" value={sum ? brl(cents(sum.ticket_medio)) : '—'} />
        <Kpi icon={CheckCircle2} label="Comissões pagas" value={sum ? brl(cents(sum.comissoes_pagas)) : '—'} />
        <Kpi icon={BadgeCheck} label="Comissões previstas" value={sum ? brl(cents(sum.comissoes_previstas)) : '—'}
          sub={sum ? `${sum.comissoes_qtd_prevista} pendente${sum.comissoes_qtd_prevista !== 1 ? 's' : ''}` : ''} />
      </div>

      {/* Histórico mensal */}
      {sum?.historico_mensal && sum.historico_mensal.length > 0 && (
        <div className="card mb-6 overflow-x-auto p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Liberações por mês</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500">
              <tr><th className="py-2">Mês</th><th className="py-2 text-right">Liberações</th><th className="py-2 text-right">Volume</th></tr>
            </thead>
            <tbody>
              {sum.historico_mensal.map(m => (
                <tr key={m.mes} className="border-t border-silver-100">
                  <td className="py-2">{new Date(m.mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
                  <td className="py-2 text-right">{m.qtd}</td>
                  <td className="py-2 text-right font-medium">{brl(cents(m.volume))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comissões */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-silver-100 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-silver-500">Comissões</h3>
          <div className="flex gap-1">
            {(['prevista','aprovada','paga','todas'] as const).map(s => (
              <button key={s} onClick={() => setStatusFiltro(s)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${statusFiltro === s ? 'bg-navy text-white' : 'bg-silver-50 text-silver-700 hover:bg-silver-100'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {comissoesQuery.isLoading ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-red-700" /></div>
        ) : comissoes.length === 0 ? (
          <p className="p-10 text-center text-sm text-silver-500">Nenhuma comissão.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
              <tr>
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {comissoes.map(c => (
                <tr key={c.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{c.partner_nome ?? '—'}</p>
                    <p className="text-xs text-silver-500">{c.partner_email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-silver-600">{c.protocolo ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{Number(c.percentual).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-bold text-navy">{brl(cents(c.valor))}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      c.status === 'paga' ? 'bg-success/15 text-success' :
                      c.status === 'aprovada' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-silver-500">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {c.status === 'prevista' && (
                        <button className="btn-outline text-xs" disabled={aprovarMut.isPending}
                          onClick={() => aprovarMut.mutate(c.id)}>Aprovar</button>
                      )}
                      {c.status !== 'paga' && (
                        <button className="btn-gold text-xs" disabled={pagarMut.isPending}
                          onClick={() => pagarMut.mutate(c.id)}>Marcar paga</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof DollarSign; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-silver-500">
        <Icon className="h-4 w-4 text-red-700" />
        <p className="text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold text-navy">{value}</p>
      {sub && <p className="text-xs text-silver-500">{sub}</p>}
    </div>
  )
}


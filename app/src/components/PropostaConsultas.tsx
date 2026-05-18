import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, AlertTriangle, CheckCircle2, XCircle, RotateCcw, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = {
  bacen_cpf: 'Bacen CPF',
  bacen_cnpj: 'Bacen CNPJ',
  serasa_pf: 'Serasa PF',
  serasa_pj: 'Serasa PJ',
  jusbrasil_cnpj: 'Jusbrasil CNPJ',
  escavador_cnpj: 'Escavador CNPJ',
  ri_digital_matricula: 'RI Digital · matrícula',
  nacional_consultas_bens: 'Nacional · bens',
  nacional_consultas_certidao: 'Nacional · certidão',
}

interface Preco {
  tipo: string
  preco_centavos: number
  descricao: string | null
}

interface LogRow {
  id: string
  tipo: string
  status: 'em_andamento' | 'concluida' | 'falha' | 'estornada'
  preco_centavos: number
  resumo: Record<string, unknown> | null
  erro: string | null
  provedor: string | null
  iniciado_em: string
  concluido_em: string | null
  iniciado_por_nome: string | null
}

interface Props {
  propostaId: string
  readOnly?: boolean
}

export function PropostaConsultas({ propostaId, readOnly = false }: Props) {
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)
  const [executingTipo, setExecutingTipo] = useState<string | null>(null)
  const [detalheLog, setDetalheLog] = useState<string | null>(null)

  const precosQuery = useQuery({
    queryKey: ['consulta-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_consulta')
        .select('tipo, preco_centavos, descricao')
        .is('vigente_ate', null)
        .order('tipo')
      if (error) throw error
      return (data ?? []) as Preco[]
    },
  })

  const logsQuery = useQuery({
    queryKey: ['consultas-proposta', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_consultas_proposta')
        .select('id, tipo, status, preco_centavos, resumo, erro, provedor, iniciado_em, concluido_em, iniciado_por_nome')
        .eq('proposta_id', propostaId)
        .order('iniciado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as LogRow[]
    },
  })

  const executar = useMutation({
    mutationFn: async (tipo: string) => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${baseUrl}/functions/v1/consulta-executar`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ proposta_id: propostaId, tipo }),
      })
      const json = await res.json()
      if (!res.ok) {
        const map: Record<string, string> = {
          saldo_insuficiente: 'Saldo insuficiente — recarregue a carteira.',
          wallet_bloqueada: 'Carteira bloqueada pelo admin.',
          preco_nao_configurado: 'Preço não configurado para este tipo.',
          falha_provedor: 'Falha no provedor — valor estornado.',
        }
        throw new Error(map[json.error] ?? json.error ?? `HTTP ${res.status}`)
      }
      return json as { log_id: string; preco_centavos: number }
    },
    onMutate: (tipo) => { setExecutingTipo(tipo); setErro(null) },
    onSettled: () => setExecutingTipo(null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consultas-proposta', propostaId] })
      void qc.invalidateQueries({ queryKey: ['wallet-resumo'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const detalheQuery = useQuery({
    queryKey: ['consulta-detalhe', detalheLog],
    enabled: !!detalheLog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs_consultas')
        .select('id, tipo, status, response, request, erro, provedor, iniciado_em, concluido_em, preco_centavos')
        .eq('id', detalheLog!)
        .single()
      if (error) throw error
      return data
    },
  })

  const precos = precosQuery.data ?? []
  const logs = logsQuery.data ?? []

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Disponíveis</h3>
          <p className="mb-4 text-xs text-silver-500">
            Cada consulta debita o valor da carteira do parceiro. Em caso de falha do provedor, o valor é estornado automaticamente.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {precos.map(p => (
              <button
                key={p.tipo}
                onClick={() => executar.mutate(p.tipo)}
                disabled={executar.isPending}
                className="flex items-center justify-between rounded-lg border border-silver-200 p-3 text-left transition hover:border-gold hover:bg-gold/5 disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-navy">{TIPO_LABEL[p.tipo] ?? p.tipo}</p>
                  {p.descricao && <p className="text-xs text-silver-500">{p.descricao}</p>}
                  <p className="mt-1 text-xs font-bold text-gold">{brl(p.preco_centavos)}</p>
                </div>
                {executingTipo === p.tipo ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gold" />
                ) : (
                  <Search className="h-5 w-5 text-silver-400" />
                )}
              </button>
            ))}
          </div>
          {erro && (
            <div className="mt-3 flex items-start gap-2 rounded border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {erro}
            </div>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="border-b border-silver-100 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-silver-500">Histórico</h3>
        </div>
        {logsQuery.isLoading ? (
          <div className="p-10 text-center text-sm text-silver-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : logs.length === 0 ? (
          <p className="p-10 text-center text-sm text-silver-500">Nenhuma consulta executada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Custo</th>
                <th className="px-4 py-3">Resumo</th>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-4 py-3 font-medium text-navy">{TIPO_LABEL[l.tipo] ?? l.tipo}</td>
                  <td className="px-4 py-3"><StatusPill status={l.status} /></td>
                  <td className="px-4 py-3 text-right font-medium">
                    {l.status === 'estornada' ? <span className="text-silver-400 line-through">{brl(l.preco_centavos)}</span> : brl(l.preco_centavos)}
                  </td>
                  <td className="px-4 py-3 text-xs text-silver-600">
                    {l.erro ? <span className="text-danger">{l.erro}</span> : <ResumoCell resumo={l.resumo} />}
                  </td>
                  <td className="px-4 py-3 text-xs text-silver-500">{new Date(l.iniciado_em).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDetalheLog(l.id)} className="btn-outline text-xs"><Eye className="h-3 w-3" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalheLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetalheLog(null)}>
          <div className="card w-full max-w-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold text-navy">Detalhe da consulta</h3>
            {detalheQuery.isLoading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : detalheQuery.data ? (
              <pre className="max-h-96 overflow-auto rounded bg-silver-50 p-3 text-xs">{JSON.stringify(detalheQuery.data, null, 2)}</pre>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button className="btn-outline" onClick={() => setDetalheLog(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: LogRow['status'] }) {
  const cfg: Record<LogRow['status'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    em_andamento: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700', Icon: Loader2 },
    concluida: { label: 'Concluída', cls: 'bg-success/15 text-success', Icon: CheckCircle2 },
    falha: { label: 'Falha', cls: 'bg-danger/15 text-danger', Icon: XCircle },
    estornada: { label: 'Estornada', cls: 'bg-silver-200 text-silver-700', Icon: RotateCcw },
  }
  const { label, cls, Icon } = cfg[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className={`h-3 w-3 ${status === 'em_andamento' ? 'animate-spin' : ''}`} /> {label}
    </span>
  )
}

function ResumoCell({ resumo }: { resumo: Record<string, unknown> | null }) {
  if (!resumo) return <span className="text-silver-400">—</span>
  const score = resumo.score
  const totals = resumo.totals as Record<string, unknown> | undefined
  const parts: string[] = []
  if (typeof score === 'number') parts.push(`score ${score}`)
  if (totals) {
    for (const [k, v] of Object.entries(totals)) {
      if (typeof v === 'number') {
        if (k.includes('centavos')) parts.push(`${k.replace('_centavos', '')}: ${brl(v)}`)
        else parts.push(`${k}: ${v}`)
      }
    }
  }
  return <span>{parts.length ? parts.join(' · ') : 'ok'}</span>
}

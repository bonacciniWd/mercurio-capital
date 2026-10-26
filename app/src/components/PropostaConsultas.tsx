import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertTriangle, CheckCircle2, XCircle, RotateCcw, Eye, Clock3,
  Building2, ShieldCheck, Scale, Globe, FileSearch, Landmark, Play, ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { BrandLoading } from '@/components/BrandLoading'

const TIPO_LABEL: Record<string, string> = {
  bacen_cpf: 'Bacen CPF',
  bacen_cnpj: 'Bacen CNPJ',
  serasa_pf: 'Serasa PF',
  serasa_pj: 'Serasa PJ',
  jusbrasil_cnpj: 'Jusbrasil CNPJ',
  escavador_cnpj: 'Escavador CNPJ',
  ri_digital_matricula: 'RI Digital · Matrícula',
  nacional_consultas_bens: 'Nacional · Bens',
  nacional_consultas_certidao: 'Nacional · Certidão',
}

const TIPO_META: Record<string, { Icon: typeof Building2; cor: string; grupo: string; hint: string }> = {
  bacen_cpf:               { Icon: Landmark,    cor: 'text-blue-600 bg-blue-50',    grupo: 'Banco Central', hint: 'Relacionamentos bancários PF' },
  bacen_cnpj:              { Icon: Landmark,    cor: 'text-blue-600 bg-blue-50',    grupo: 'Banco Central', hint: 'Relacionamentos bancários PJ' },
  serasa_pf:               { Icon: ShieldCheck, cor: 'text-orange-600 bg-orange-50', grupo: 'Serasa',       hint: 'Relatório avançado PF com Score' },
  serasa_pj:               { Icon: ShieldCheck, cor: 'text-orange-600 bg-orange-50', grupo: 'Serasa',       hint: 'Relatório avançado analítico PJ' },
  jusbrasil_cnpj:          { Icon: Scale,       cor: 'text-purple-600 bg-purple-50', grupo: 'Jusbrasil',    hint: 'Processos judiciais CNPJ' },
  escavador_cnpj:          { Icon: Scale,       cor: 'text-purple-600 bg-purple-50', grupo: 'Escavador',    hint: 'Processos e sócios CNPJ' },
  ri_digital_matricula:    { Icon: FileSearch,  cor: 'text-teal-600 bg-teal-50',    grupo: 'RI Digital',   hint: 'Matrícula e ônus do imóvel' },
  nacional_consultas_bens: { Icon: Building2,   cor: 'text-navy bg-navy/10',        grupo: 'Nacional',     hint: 'Pesquisa de bens patrimoniais' },
  nacional_consultas_certidao: { Icon: Globe,   cor: 'text-emerald-600 bg-emerald-50', grupo: 'Nacional',  hint: 'Certidões nacionais' },
}

interface Preco {
  tipo: string
  preco_centavos: number
  descricao: string | null
}

interface LogRow {
  id: string
  tipo: string
  status: 'em_andamento' | 'concluida' | 'falha' | 'estornada' | 'reconciliacao_pendente'
  preco_centavos: number
  resumo: Record<string, unknown> | null
  erro: string | null
  provedor: string | null
  iniciado_em: string
  concluido_em: string | null
  iniciado_por_nome: string | null
  ambiente?: string | null
  produto_relatorio?: string | null
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
  const [tipoAutorizando, setTipoAutorizando] = useState<string | null>(null)
  const [evidenciaId, setEvidenciaId] = useState('')
  const [baseLegal, setBaseLegal] = useState<'procedimentos_preliminares_contrato' | 'protecao_do_credito'>('procedimentos_preliminares_contrato')
  const authorizationKeys = useRef(new Map<string, string>())
  const requestKeys = useRef(new Map<string, string>())

  const evidenciasQuery = useQuery({
    queryKey: ['consulta-evidencias-aprovadas', propostaId],
    enabled: !!tipoAutorizando,
    queryFn: async () => {
      const { data, error } = await supabase.from('proposta_documentos')
        .select('id, tipo, categoria, created_at')
        .eq('proposta_id', propostaId)
        .eq('status', 'aprovado')
        .eq('validado', true)
        .not('storage_path', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

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
        .select('id, tipo, status, preco_centavos, resumo, erro, provedor, ambiente, produto_relatorio, iniciado_em, concluido_em, iniciado_por_nome')
        .eq('proposta_id', propostaId)
        .order('iniciado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as LogRow[]
    },
  })

  const executar = useMutation({
    mutationFn: async (input: { tipo: string; documentoId: string; baseLegal: string }) => {
      const { tipo, documentoId } = input
      const scope = `${propostaId}:${tipo}`
      const authorizationKey = authorizationKeys.current.get(scope) ?? crypto.randomUUID()
      authorizationKeys.current.set(scope, authorizationKey)
      const { data: authorizationId, error: authorizationError } = await supabase.rpc('consulta_autorizacao_registrar', {
        p_proposta_id: propostaId,
        p_tipo: tipo,
        p_documento_evidencia_id: documentoId,
        p_base_legal: input.baseLegal,
        p_chave_registro: authorizationKey,
      })
      if (authorizationError || !authorizationId) {
        throw new Error(authorizationError?.message ?? 'Não foi possível registrar a autorização documentada.')
      }

      const requestKey = requestKeys.current.get(scope) ?? crypto.randomUUID()
      requestKeys.current.set(scope, requestKey)
      const { data, error } = await supabase.functions.invoke('consulta-executar', {
        body: {
          proposta_id: propostaId,
          tipo,
          autorizacao_id: authorizationId,
          chave_idempotencia: requestKey,
        },
      })

      if (error) {
        let errorCode = ''
        const ctx = (error as { context?: Response }).context
        try {
          if (ctx && typeof ctx.json === 'function') {
            const payload = await ctx.json() as { error?: string }
            errorCode = payload.error ?? ''
          }
        } catch {
          /* ignore */
        }

        const map: Record<string, string> = {
          saldo_insuficiente: 'Saldo insuficiente — recarregue a carteira.',
          wallet_bloqueada: 'Carteira bloqueada pelo admin.',
          preco_nao_configurado: 'Preço não configurado para este tipo.',
          falha_provedor: 'Falha no provedor — confira o histórico e o estorno.',
          bacen_nao_configurado: 'Bacen ainda não configurado — nenhuma consulta foi realizada.',
          serasa_nao_configurado: 'Serasa ainda não configurado — nenhuma consulta foi realizada.',
          documento_titular_invalido: 'O CPF/CNPJ da proposta está ausente ou inválido.',
          autorizacao_documentada_obrigatoria: 'Registre a autorização usando um documento aprovado da proposta.',
          autorizacao_documento_ou_titular_invalido: 'A autorização ou o documento aprovado não corresponde a esta proposta.',
          serasa_relatorio_desativado: 'Este relatório Serasa está desativado para o ambiente atual.',
          serasa_parametros_pj_pendentes: 'A configuração do relatório PJ ainda precisa de validação para este ambiente.',
          serasa_cnpj_consultante_ausente: 'Configure o CNPJ da Mercúrio como correspondente no ambiente Serasa de produção.',
          serasa_ambiente_ou_url_invalida: 'O ambiente Serasa não está configurado de forma segura.',
          serasa_produto_nao_permitido: 'O produto Serasa configurado não está permitido para esta consulta.',
          resultado_pendente_reconciliacao: 'A consulta foi enviada; o resultado aguarda reconciliação. Não repita agora.',
          estorno_pendente_reconciliacao: 'O estorno aguarda reconciliação. Não repita agora.',
          consulta_em_andamento: 'Esta consulta ainda está em processamento.',
        }
        if (ctx?.status && ctx.status >= 400 && ctx.status < 500) {
          authorizationKeys.current.delete(scope)
          requestKeys.current.delete(scope)
        }
        throw new Error(map[errorCode] ?? error.message ?? 'Falha ao executar consulta.')
      }

      const response = data as { log_id?: string; preco_centavos?: number; error?: string; status?: string } | null
      if (response?.error === 'consulta_em_reconciliacao') {
        throw new Error('A consulta está em reconciliação. Não repita agora; acompanhe o histórico da proposta.')
      }

      authorizationKeys.current.delete(scope)
      requestKeys.current.delete(scope)
      return response as { log_id: string; preco_centavos: number }
    },
    onMutate: ({ tipo }) => { setExecutingTipo(tipo); setErro(null) },
    onSettled: () => setExecutingTipo(null),
    onSuccess: () => {
      setTipoAutorizando(null)
      void qc.invalidateQueries({ queryKey: ['consultas-proposta', propostaId] })
      void qc.invalidateQueries({ queryKey: ['wallet-resumo'] })
    },
    onError: (e) => {
      setErro(e instanceof Error ? e.message : 'falha')
      void qc.invalidateQueries({ queryKey: ['consultas-proposta', propostaId] })
      void qc.invalidateQueries({ queryKey: ['wallet-resumo'] })
    },
  })

  const detalheQuery = useQuery({
    queryKey: ['consulta-detalhe', detalheLog],
    enabled: !!detalheLog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_consultas_proposta')
        .select('id, tipo, status, resumo, erro, provedor, ambiente, produto_relatorio, iniciado_em, concluido_em, preco_centavos')
        .eq('id', detalheLog!)
        .single()
      if (error) throw error
      return data
    },
  })

  const precos = precosQuery.data ?? []
  const logs = logsQuery.data ?? []

  const ultimoLogPorTipo = new Map<string, LogRow>()
  for (const log of logs) {
    if (!ultimoLogPorTipo.has(log.tipo)) {
      ultimoLogPorTipo.set(log.tipo, log)
    }
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-navy">Consultas disponíveis</h3>
              <p className="mt-0.5 text-xs text-silver-500">
                Cada consulta debita a carteira. Em caso de falha do provedor o valor é estornado automaticamente.
              </p>
            </div>
          </div>

          {precosQuery.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-silver-400" /></div>
          ) : precos.length === 0 ? (
            <p className="py-6 text-center text-sm text-silver-400">Nenhum serviço de consulta configurado.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {precos.map(p => {
                const meta = TIPO_META[p.tipo]
                const Icon = meta?.Icon ?? FileSearch
                const isRunning = executingTipo === p.tipo
                const ultimo = ultimoLogPorTipo.get(p.tipo)

                const statusClass = ultimo
                  ? ultimo.status === 'concluida'
                    ? 'text-success bg-success/10 border-success/20'
                    : ultimo.status === 'falha'
                      ? 'text-danger bg-danger/10 border-danger/20'
                      : ultimo.status === 'estornada'
                        ? 'text-silver-600 bg-silver-100 border-silver-200'
                        : 'text-blue-700 bg-blue-50 border-blue-200'
                  : 'text-silver-500 bg-silver-50 border-silver-200'

                return (
                  <article
                    key={p.tipo}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-silver-200 bg-gradient-to-b from-white to-silver-50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-navy/20 hover:shadow-[0_10px_24px_rgba(15,23,42,0.10)]"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500/70 via-gold/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                    <div className="flex items-start justify-between gap-3">
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 ${meta?.cor ?? 'text-silver-500 bg-silver-100'}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-silver-500">{meta?.grupo ?? 'Consulta'}</p>
                        <p className="mt-1 text-sm font-semibold leading-snug text-navy">
                          {TIPO_LABEL[p.tipo] ?? p.tipo}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-silver-400">Custo</p>
                        <p className="text-sm font-bold text-red-600">{brl(p.preco_centavos)}</p>
                      </div>
                    </div>

                    <p className="mt-1 flex-1 text-xs leading-relaxed text-silver-500">
                      {p.descricao ?? meta?.hint ?? ''}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-silver-100 pt-3 text-[11px]">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium ${statusClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          ultimo?.status === 'concluida'
                            ? 'bg-success'
                            : ultimo?.status === 'falha'
                              ? 'bg-danger'
                              : ultimo?.status === 'estornada'
                                ? 'bg-silver-500'
                            : ultimo?.status === 'em_andamento'
                                  ? 'bg-blue-600'
                                  : ultimo?.status === 'reconciliacao_pendente'
                                    ? 'bg-amber-500'
                                  : 'bg-silver-400'
                        }`} />
                        Última: {ultimo ? statusLabel(ultimo.status) : 'não executada'}
                      </span>

                      <span className="text-silver-500">{ultimo ? formatWhen(ultimo.iniciado_em) : '—'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTipoAutorizando(p.tipo)
                        setEvidenciaId('')
                        setBaseLegal('procedimentos_preliminares_contrato')
                      }}
                      disabled={executar.isPending}
                      className="btn-no-liquid mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Consultando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> Executar consulta <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          {erro && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
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
              <div className="max-h-96 overflow-auto rounded bg-silver-50 p-3 text-xs">
                <p><strong>Provedor:</strong> {detalheQuery.data.provedor ?? '—'}</p>
                <p><strong>Ambiente:</strong> {detalheQuery.data.ambiente ?? 'histórico anterior'}</p>
                <p><strong>Produto:</strong> {detalheQuery.data.produto_relatorio ?? 'registro legado'}</p>
                <p><strong>Status:</strong> {detalheQuery.data.status}</p>
                <p className="mt-2 font-semibold">Resumo normalizado</p>
                <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(detalheQuery.data.resumo ?? {}, null, 2)}</pre>
              </div>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button className="btn-outline" onClick={() => setDetalheLog(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {tipoAutorizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setTipoAutorizando(null)}>
          <section className="card w-full max-w-lg p-5" role="dialog" aria-modal="true" aria-labelledby="consulta-autorizacao-titulo" onClick={event => event.stopPropagation()}>
            <h3 id="consulta-autorizacao-titulo" className="text-lg font-bold text-navy">Autorização documentada</h3>
            <p className="mt-2 text-sm text-silver-600">Selecione o documento aprovado da proposta que registra a autorização do titular para esta consulta Serasa.</p>
            <label className="mt-4 block text-xs font-semibold text-silver-600" htmlFor="consulta-evidencia">Documento aprovado</label>
            <select id="consulta-evidencia" className="input mt-1 w-full" value={evidenciaId} onChange={event => setEvidenciaId(event.target.value)}>
              <option value="">Selecione um documento</option>
              {(evidenciasQuery.data ?? []).map(document => (
                <option key={document.id} value={document.id}>{document.tipo} · {new Date(document.created_at).toLocaleDateString('pt-BR')}</option>
              ))}
            </select>
            {evidenciasQuery.isLoading && <p className="mt-2 text-xs text-silver-500">Carregando documentos...</p>}
            {!evidenciasQuery.isLoading && (evidenciasQuery.data ?? []).length === 0 && (
              <p className="mt-2 text-xs text-danger">Não há documento aprovado para comprovar a autorização. Anexe e aprove o documento antes de consultar.</p>
            )}
            <fieldset className="mt-4 space-y-2">
              <legend className="text-xs font-semibold text-silver-600">Finalidade e base legal registrada</legend>
              <label className="flex items-center gap-2 text-sm text-silver-700">
                <input type="radio" name="consulta-base-legal" checked={baseLegal === 'procedimentos_preliminares_contrato'} onChange={() => setBaseLegal('procedimentos_preliminares_contrato')} />
                Análise de crédito solicitada pelo titular · procedimentos preliminares
              </label>
              <label className="flex items-center gap-2 text-sm text-silver-700">
                <input type="radio" name="consulta-base-legal" checked={baseLegal === 'protecao_do_credito'} onChange={() => setBaseLegal('protecao_do_credito')} />
                Proteção do crédito
              </label>
            </fieldset>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setTipoAutorizando(null)}>Cancelar</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!evidenciaId || executar.isPending || evidenciasQuery.isLoading}
                onClick={() => executar.mutate({ tipo: tipoAutorizando, documentoId: evidenciaId, baseLegal })}
              >
                {executar.isPending ? 'Consultando...' : 'Registrar e consultar'}
              </button>
            </div>
          </section>
        </div>
      )}

      {executar.isPending && (
        <BrandLoading message="Consultando dados externos. Isso pode levar alguns instantes." />
      )}
    </div>
  )
}

function statusLabel(status: LogRow['status']) {
  const labels: Record<LogRow['status'], string> = {
    em_andamento: 'em andamento',
    concluida: 'concluída',
    falha: 'falha',
    estornada: 'estornada',
    reconciliacao_pendente: 'reconciliação pendente',
  }
  return labels[status]
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const dias = Math.floor(h / 24)
  if (dias < 30) return `há ${dias}d`
  return d.toLocaleDateString('pt-BR')
}

function StatusPill({ status }: { status: LogRow['status'] }) {
  const cfg: Record<LogRow['status'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    em_andamento: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700', Icon: Loader2 },
    concluida: { label: 'Concluída', cls: 'bg-success/15 text-success', Icon: CheckCircle2 },
    falha: { label: 'Falha', cls: 'bg-danger/15 text-danger', Icon: XCircle },
    estornada: { label: 'Estornada', cls: 'bg-silver-200 text-silver-700', Icon: RotateCcw },
    reconciliacao_pendente: { label: 'Em reconciliação', cls: 'bg-amber-100 text-amber-800', Icon: Clock3 },
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

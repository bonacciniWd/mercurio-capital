import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings2, Zap, ExternalLink, Apple, RefreshCw, Loader2, SlidersHorizontal,
  CheckCircle2, AlertTriangle, Clock, PowerOff, Search, KeyRound,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'

type Status = 'conectado' | 'erro' | 'pendente' | 'desconectado'

interface Integracao {
  id: string
  chave: string
  nome: string
  categoria: string
  descricao: string | null
  provider: string | null
  secrets_requeridas: string[]
  docs_url: string | null
  restricao_plataforma: string | null
  ativo: boolean
  ultimo_status: Status
  ultima_checagem: string | null
  ultimo_erro: string | null
  latencia_ms: number | null
  metricas: Record<string, unknown>
  eventos_24h: number
  fila_pendente: number
}

interface BackfillAceitePreview {
  protocolo: string
  status_revisado: string
  status_atual: string | null
  elegivel: boolean
  ja_registrado: boolean
}

interface BackfillAceiteResult {
  protocolos_revisados: number
  propostas_elegiveis: number
  inseridos: number
  ja_registrados: number
}

const BACKFILL_ACEITE_PROTOCOLOS_REVISADOS = 138

const STATUS_BADGE: Record<Status, { variant: 'green' | 'red' | 'yellow' | 'gray'; label: string }> = {
  conectado:    { variant: 'green',  label: 'Conectado' },
  erro:         { variant: 'red',    label: 'Erro' },
  pendente:     { variant: 'yellow', label: 'Pendente' },
  desconectado: { variant: 'gray',   label: 'Inativo' },
}

const BRAND_LOGO: Record<string, string> = {
  stripe: '/brands/stripe.jpeg',
  whatsapp: '/brands/evolution-logo.png',
  clicksign: '/brands/clicksign.jpeg',
  serasa: '/brands/sersa-experian.jpeg',
  bacen: '/brands/bacen.png',
  jusbrasil: '/brands/jusbrasil.png',
  escavador: '/brands/escavador.png',
  ri_digital: '/brands/ri-digital.png',
  vimeo: '/brands/vimeo.jpeg',
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return 'nunca testada'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

// Extrai secrets faltantes do texto "secrets ausentes: A, B, C" gravado pela edge.
function parseSecretsFaltando(ultimo_erro: string | null): string[] {
  if (!ultimo_erro) return []
  const m = ultimo_erro.match(/secrets ausentes:\s*(.+)$/i)
  if (!m) return []
  return m[1].split(',').map(s => s.trim()).filter(Boolean)
}

type FiltroStatus = 'todos' | Status

export function AdminIntegracoes() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [testando, setTestando] = useState<string | null>(null)
  const [testandoTodas, setTestandoTodas] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [avisoSerasa, setAvisoSerasa] = useState<string | null>(null)
  const [avisoBackfillAceite, setAvisoBackfillAceite] = useState<string | null>(null)
  const [featuresPf, setFeaturesPf] = useState<string[]>([])
  const [scoreModelPf, setScoreModelPf] = useState('')
  const [rendaModelPf, setRendaModelPf] = useState('HRM5')

  const serasaReportQuery = useQuery({
    queryKey: ['admin-serasa-relatorio-config', 'producao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('serasa_relatorios_config')
        .select('ambiente, ativo, report_pf, report_pj, parametros_pj, features_pf, parametros_pf')
        .eq('ambiente', 'producao')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    const config = serasaReportQuery.data
    if (!config) return
    const features = Array.isArray(config.features_pf) ? config.features_pf.filter((item): item is string => typeof item === 'string') : []
    const parameters = config.parametros_pf && typeof config.parametros_pf === 'object'
      ? (config.parametros_pf as { reportParameters?: Array<{ name?: string; value?: string }> }).reportParameters ?? []
      : []
    setFeaturesPf(features)
    setScoreModelPf(parameters.find(item => item.name === 'SCORE')?.value ?? '')
    setRendaModelPf(parameters.find(item => item.name === 'RENDA_MAIS')?.value ?? 'HRM5')
  }, [serasaReportQuery.data])

  const serasaPfFeaturesMutation = useMutation({
    mutationFn: async () => {
      const reportParameters = [
        ...(featuresPf.includes('SCORE') && scoreModelPf ? [{ name: 'SCORE', value: scoreModelPf }] : []),
        ...(featuresPf.includes('RENDA_MAIS') ? [{ name: 'RENDA_MAIS', value: rendaModelPf }] : []),
      ]
      const { error } = await supabase.rpc('admin_serasa_pf_features_atualizar', {
        p_ambiente: 'producao',
        p_features: featuresPf,
        p_parametros: reportParameters.length ? { reportParameters } : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setAvisoSerasa('Features PF atualizadas. Novas consultas usarão a configuração; nenhuma consulta foi executada agora.')
      void qc.invalidateQueries({ queryKey: ['admin-serasa-relatorio-config', 'producao'] })
    },
    onError: () => setAvisoSerasa('Não foi possível salvar as features PF. A RPC exige Admin full e valida os modelos permitidos.'),
  })

  const serasaReportMutation = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await supabase.rpc('admin_serasa_relatorio_config_atualizar', {
        p_ambiente: 'producao',
        p_ativo: ativo,
        p_segment_code: null,
      })
      if (error) throw error
    },
    onSuccess: (_, ativo) => {
      setAvisoSerasa(ativo
        ? 'Relatório PF de produção ativado. Nenhuma consulta foi executada.'
        : 'Relatório PF de produção desativado.')
      void qc.invalidateQueries({ queryKey: ['admin-serasa-relatorio-config', 'producao'] })
    },
    onError: () => setAvisoSerasa('Não foi possível alterar a configuração do relatório Serasa.'),
  })

  const backfillAceitePreviewQuery = useQuery({
    queryKey: ['admin-proposta-consulta-aceites-backfill-preview'],
    queryFn: async (): Promise<BackfillAceitePreview[]> => {
      const { data, error } = await supabase.rpc('admin_proposta_consulta_aceites_atestar_retroativo_preview')
      if (error) throw error
      return (data ?? []) as unknown as BackfillAceitePreview[]
    },
  })

  const backfillAceiteMutation = useMutation({
    mutationFn: async (): Promise<BackfillAceiteResult> => {
      const { data, error } = await supabase.rpc('admin_proposta_consulta_aceites_atestar_retroativo_revisado')
      if (error) throw error
      const result = Array.isArray(data) ? data[0] : data
      if (!result || typeof result !== 'object') throw new Error('resposta_invalida')
      return result as unknown as BackfillAceiteResult
    },
    onSuccess: (result) => {
      setAvisoBackfillAceite(
        `Backfill concluído para ${result.protocolos_revisados} protocolos: ${result.inseridos} novos atestados e ${result.ja_registrados} registros já existentes.`,
      )
      void backfillAceitePreviewQuery.refetch()
    },
    onError: () => setAvisoBackfillAceite('Não foi possível executar o backfill. Atualize a prévia e confira se algum protocolo mudou para status inelegível.'),
  })

  const listQuery = useQuery({
    queryKey: ['admin-integracoes-web'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_admin_integracoes').select('*')
      if (error) throw error
      return (data ?? []) as Integracao[]
    },
  })

  const backfillRows = backfillAceitePreviewQuery.data ?? []
  const backfillInvalidCount = backfillRows.filter(row => !row.elegivel).length
  const backfillAlreadyRegisteredCount = backfillRows.filter(row => row.ja_registrado).length
  const backfillStatusChangedCount = backfillRows.filter(row => row.status_atual !== row.status_revisado).length
  const backfillNewCount = backfillRows.filter(row => row.elegivel && !row.ja_registrado).length
  const backfillCanRun = !backfillAceitePreviewQuery.isLoading
    && !backfillAceitePreviewQuery.isError
    && backfillRows.length === BACKFILL_ACEITE_PROTOCOLOS_REVISADOS
    && backfillInvalidCount === 0
    && !backfillAceiteMutation.isPending

  const toggleMut = useMutation({
    mutationFn: async ({ chave, ativo }: { chave: string; ativo: boolean }) => {
      const { error } = await supabase.rpc('admin_integracao_toggle', { p_chave: chave, p_ativo: ativo })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-integracoes-web'] }),
  })

  async function testar(chave: string) {
    setTestando(chave)
    try {
      await supabase.functions.invoke('integracao-testar', { body: { chave } })
      await qc.invalidateQueries({ queryKey: ['admin-integracoes-web'] })
    } finally {
      setTestando(null)
    }
  }

  async function testarTodas() {
    if (!listQuery.data) return
    setTestandoTodas(true)
    try {
      // sequencial para evitar bursts e respeitar rate-limits dos provedores
      for (const i of listQuery.data.filter(x => x.ativo)) {
        try { await supabase.functions.invoke('integracao-testar', { body: { chave: i.chave } }) } catch { /* segue */ }
      }
      await qc.invalidateQueries({ queryKey: ['admin-integracoes-web'] })
    } finally {
      setTestandoTodas(false)
    }
  }

  const integracoes = listQuery.data ?? []

  const categorias = useMemo(
    () => Array.from(new Set(integracoes.map(i => i.categoria))).sort(),
    [integracoes],
  )

  const resumo = useMemo(() => ({
    conectado:    integracoes.filter(i => i.ativo && i.ultimo_status === 'conectado').length,
    erro:         integracoes.filter(i => i.ativo && i.ultimo_status === 'erro').length,
    pendente:     integracoes.filter(i => i.ativo && i.ultimo_status === 'pendente').length,
    desconectado: integracoes.filter(i => !i.ativo).length,
  }), [integracoes])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return integracoes.filter(i => {
      if (filtroCategoria !== 'todas' && i.categoria !== filtroCategoria) return false
      if (filtroStatus !== 'todos') {
        const st: Status = !i.ativo ? 'desconectado' : i.ultimo_status
        if (st !== filtroStatus) return false
      }
      if (q && !`${i.nome} ${i.provider ?? ''} ${i.descricao ?? ''} ${i.chave}`.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [integracoes, busca, filtroStatus, filtroCategoria])

  const resumoCards: { key: FiltroStatus; label: string; valor: number; icon: typeof CheckCircle2; cor: string }[] = [
    { key: 'conectado',    label: 'Conectadas',  valor: resumo.conectado,    icon: CheckCircle2,   cor: 'text-green-600 bg-green-50' },
    { key: 'erro',         label: 'Com erro',    valor: resumo.erro,         icon: AlertTriangle,  cor: 'text-red-600 bg-red-50' },
    { key: 'pendente',     label: 'Pendentes',   valor: resumo.pendente,     icon: Clock,          cor: 'text-yellow-700 bg-yellow-50' },
    { key: 'desconectado', label: 'Inativas',    valor: resumo.desconectado, icon: PowerOff,       cor: 'text-silver-600 bg-silver-100' },
  ]

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Integrações externas</h1>
          <p className="mt-1 text-sm text-silver-500">
            Visão central das integrações do sistema — secrets, status de saúde, métricas e teste de conexão em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testarTodas}
            disabled={testandoTodas || listQuery.isLoading}
            className="btn-no-liquid inline-flex items-center gap-2 rounded-lg bg-gold-600 px-3 py-2 text-sm font-medium text-white hover:bg-gold-700 disabled:opacity-60"
          >
            {testandoTodas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Testar todas
          </button>
          <button
            type="button"
            onClick={() => listQuery.refetch()}
            className="btn-no-liquid inline-flex items-center gap-2 rounded-lg border border-silver-200 px-3 py-2 text-sm font-medium text-silver-700 hover:bg-silver-50"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {resumoCards.map(c => {
          const Icon = c.icon
          const ativo = filtroStatus === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFiltroStatus(ativo ? 'todos' : c.key)}
              className={`btn-no-liquid card flex items-center gap-3 p-4 text-left text-silver-900 transition ${ativo ? 'ring-2 ring-gold-500' : 'hover:bg-silver-50'}`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.cor}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-silver-500">{c.label}</p>
                <p className="text-2xl font-bold text-navy">{c.valor}</p>
              </div>
            </button>
          )
        })}
      </div>

      <section className="mb-6 rounded-xl border border-silver-200 bg-white p-5 shadow-sm" aria-labelledby="serasa-report-config-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 id="serasa-report-config-title" className="font-semibold text-navy">Relatórios de crédito Serasa</h2>
            <p className="mt-1 text-xs text-silver-600">
              Controle exclusivo do relatório PF em produção. Ativar esta opção não executa consulta; cada consulta continua exigindo autorização válida na proposta e segue as regras de cobrança.
            </p>
            {serasaReportQuery.data && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-silver-600">
                <span>Ambiente: <strong>Produção</strong></span>
                <span>PF: <strong>{serasaReportQuery.data.report_pf}</strong></span>
                <span>PJ: <strong>{serasaReportQuery.data.parametros_pj ? 'Parâmetros configurados' : 'Bloqueado — segmentCode não configurado'}</strong></span>
                <span>Features PF: <strong>{Array.isArray(serasaReportQuery.data.features_pf) && serasaReportQuery.data.features_pf.length ? serasaReportQuery.data.features_pf.join(', ') : 'Nenhuma (padrão)'}</strong></span>
                <span>Status: <strong>{serasaReportQuery.data.ativo ? 'Ativo' : 'Inativo'}</strong></span>
              </div>
            )}
            {serasaReportQuery.isError && (
              <p className="mt-3 text-xs text-red-700" role="alert">Não foi possível carregar a configuração de produção. Verifique o acesso de administrador e tente atualizar.</p>
            )}
            {avisoSerasa && <p className="mt-3 text-xs text-silver-600" role="status">{avisoSerasa}</p>}
          </div>
          <button
            type="button"
            disabled={serasaReportQuery.isLoading || serasaReportQuery.isError || serasaReportMutation.isPending || serasaReportQuery.data?.report_pf !== 'RELATORIO_AVANCADO_PF'}
            onClick={() => {
              const ativar = !serasaReportQuery.data?.ativo
              const mensagem = ativar
                ? 'Ativar somente o Relatório Avançado PF em produção? Nenhuma consulta será disparada. A configuração PJ permanecerá sem segmentCode.'
                : 'Desativar o relatório Serasa em produção? Consultas novas serão bloqueadas.'
              if (window.confirm(mensagem)) serasaReportMutation.mutate(ativar)
            }}
            className={`btn-no-liquid inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${serasaReportQuery.data?.ativo ? 'bg-silver-700 hover:bg-silver-800' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {serasaReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {serasaReportQuery.data?.ativo ? 'Desativar PF produção' : 'Ativar PF produção'}
          </button>
        </div>
        <div className="mt-5 border-t border-silver-100 pt-4">
          <h3 className="text-sm font-semibold text-navy">Campos adicionais do relatório PF</h3>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-silver-600">Features começam desativadas. Só habilite após confirmar que estão incluídas no contrato Serasa. Alterar esta configuração não consulta o bureau, mas passa a solicitar esses dados nas próximas consultas e pode alterar o consumo contratado.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border border-silver-200 p-3 text-xs">
              <input type="checkbox" checked={featuresPf.includes('SCORE')} onChange={event => setFeaturesPf(current => event.target.checked ? [...new Set([...current, 'SCORE'])] : current.filter(item => item !== 'SCORE'))} />
              <span className="flex-1"><strong className="block text-silver-800">Score de crédito (SCORE)</strong><span className="mt-1 block text-silver-500">A Serasa informa score padrão do relatório quando disponível. Selecione o modelo apenas quando o canal estiver confirmado.</span>
                {featuresPf.includes('SCORE') && <select aria-label="Modelo de score PF" className="input mt-2 w-full" value={scoreModelPf} onChange={event => setScoreModelPf(event.target.value)}><option value="">Usar modelo padrão do contrato</option><option value="HSPN">HSPN · Large</option><option value="HSV4">HSV4 · Large</option><option value="HRLD">HRLD · Distribuidor</option><option value="HRLN">HRLN · PME</option><option value="HRLB">HRLB · PME</option></select>}
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-silver-200 p-3 text-xs">
              <input type="checkbox" checked={featuresPf.includes('RENDA_MAIS')} onChange={event => setFeaturesPf(current => event.target.checked ? [...new Set([...current, 'RENDA_MAIS'])] : current.filter(item => item !== 'RENDA_MAIS'))} />
              <span><strong className="block text-silver-800">Renda Mais 5.0 (RENDA_MAIS)</strong><span className="mt-1 block text-silver-500">O manual associa o modelo HRM5 à feature; disponibilidade comercial ainda precisa ser confirmada antes de habilitar.</span>
                {featuresPf.includes('RENDA_MAIS') && <select aria-label="Modelo de Renda Mais" className="input mt-2 w-full" value={rendaModelPf} onChange={event => setRendaModelPf(event.target.value)}><option value="HRM5">HRM5 · Renda Mais 5.0</option></select>}
              </span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={serasaPfFeaturesMutation.isPending || session?.adminNivel !== 'full' || (featuresPf.includes('SCORE') && !scoreModelPf)} onClick={() => {
              if (window.confirm(`Salvar as features PF ${featuresPf.length ? `(${featuresPf.join(', ')})` : 'desativadas'} para produção? Isso afeta apenas futuras consultas; nenhuma consulta será executada agora.`)) serasaPfFeaturesMutation.mutate()
            }} className="btn-no-liquid inline-flex items-center gap-2 rounded-lg border border-silver-200 px-4 py-2 text-xs font-medium text-silver-700 hover:bg-silver-50 disabled:cursor-not-allowed disabled:opacity-50">
              {serasaPfFeaturesMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar features PF
            </button>
            {session?.adminNivel !== 'full' && <span className="text-xs text-amber-700">A configuração exige perfil Admin full.</span>}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-silver-200 bg-white p-5 shadow-sm" aria-labelledby="backfill-aceite-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl flex-1">
            <h2 id="backfill-aceite-title" className="font-semibold text-navy">Aceites retrospectivos revisados</h2>
            <p className="mt-1 text-xs text-silver-600">
              Prévia e atestado administrativo limitados à lista de 138 protocolos revisada em 27/10/2026. O servidor impede a inclusão de outros protocolos e bloqueia a operação se algum item estiver cancelado, em simulação ou sem cliente associado.
            </p>

            {backfillAceitePreviewQuery.isLoading && (
              <p className="mt-3 flex items-center gap-2 text-xs text-silver-500" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando a prévia atualizada…
              </p>
            )}
            {backfillAceitePreviewQuery.isError && (
              <p className="mt-3 text-xs text-red-700" role="alert">Não foi possível carregar a lista revisada. Verifique a sessão de administrador e atualize a página.</p>
            )}

            {backfillRows.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg bg-silver-50 px-3 py-2">
                  <span className="block text-[10px] uppercase tracking-wide text-silver-500">Protocolos revisados</span>
                  <strong className="text-sm text-silver-900">{backfillRows.length} / {BACKFILL_ACEITE_PROTOCOLOS_REVISADOS}</strong>
                </div>
                <div className="rounded-lg bg-silver-50 px-3 py-2">
                  <span className="block text-[10px] uppercase tracking-wide text-silver-500">Novos atestados possíveis</span>
                  <strong className="text-sm text-silver-900">{backfillNewCount}</strong>
                </div>
                <div className="rounded-lg bg-silver-50 px-3 py-2">
                  <span className="block text-[10px] uppercase tracking-wide text-silver-500">Já registrados</span>
                  <strong className="text-sm text-silver-900">{backfillAlreadyRegisteredCount}</strong>
                </div>
                <div className={`rounded-lg px-3 py-2 ${backfillInvalidCount ? 'bg-red-50' : 'bg-silver-50'}`}>
                  <span className="block text-[10px] uppercase tracking-wide text-silver-500">Inelegíveis</span>
                  <strong className={`text-sm ${backfillInvalidCount ? 'text-red-700' : 'text-silver-900'}`}>{backfillInvalidCount}</strong>
                </div>
              </div>
            )}

            {backfillStatusChangedCount > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-900" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {backfillStatusChangedCount} propostas mudaram de status desde a revisão. Confira os protocolos e status atuais antes de confirmar.
              </p>
            )}
            {backfillInvalidCount > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                A execução está bloqueada até revisar os protocolos inelegíveis. Nenhum atestado foi gravado.
              </p>
            )}
            {avisoBackfillAceite && <p className="mt-3 text-xs text-silver-700" role="status">{avisoBackfillAceite}</p>}

            {backfillRows.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-silver-600 hover:text-silver-900">
                  Conferir protocolos e status ({backfillRows.length})
                </summary>
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-silver-100">
                  {backfillRows.map(row => (
                    <div key={row.protocolo} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-silver-100 px-3 py-2 text-[11px] last:border-b-0">
                      <code className="font-mono text-silver-800">{row.protocolo}</code>
                      <span className="text-silver-600">
                        {row.status_revisado}{row.status_atual !== row.status_revisado ? ` → ${row.status_atual ?? 'não encontrada'}` : ''}
                      </span>
                      <span className={row.elegivel ? 'text-green-700' : 'font-medium text-red-700'}>
                        {!row.elegivel ? 'Inelegível' : row.ja_registrado ? 'Já registrado' : 'Elegível'}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => void backfillAceitePreviewQuery.refetch()}
              disabled={backfillAceitePreviewQuery.isFetching || backfillAceiteMutation.isPending}
              className="btn-no-liquid inline-flex items-center justify-center gap-2 rounded-lg border border-silver-200 px-4 py-2 text-xs font-medium text-silver-700 hover:bg-silver-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${backfillAceitePreviewQuery.isFetching ? 'animate-spin' : ''}`} />
              Atualizar prévia
            </button>
            <button
              type="button"
              disabled={!backfillCanRun}
              onClick={() => {
                const message = `Atestar retrospectivamente os ${BACKFILL_ACEITE_PROTOCOLOS_REVISADOS} protocolos revisados?\n\nElegíveis agora: ${backfillRows.length}. Novos registros: ${backfillNewCount}. Já registrados: ${backfillAlreadyRegisteredCount}. Status diferentes da revisão: ${backfillStatusChangedCount}.\n\nA ação será auditada e não executa consultas Serasa nem débitos.`
                if (window.confirm(message)) backfillAceiteMutation.mutate()
              }}
              className="btn-no-liquid inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {backfillAceiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Atestar lista revisada
            </button>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, provedor ou chave…"
            className="w-full rounded-lg border border-silver-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="rounded-lg border border-silver-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
        >
          <option value="todas">Todas categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {filtroStatus !== 'todos' && (
          <button
            type="button"
            onClick={() => setFiltroStatus('todos')}
            className="btn-no-liquid rounded-lg border border-silver-200 px-3 py-2 text-xs text-silver-600 hover:bg-silver-50"
          >
            Limpar status: {STATUS_BADGE[filtroStatus as Status].label}
          </button>
        )}
      </div>

      {listQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>
      ) : visiveis.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-silver-500">
          <Settings2 className="mb-2 h-8 w-8" />
          <p className="text-sm">Nenhuma integração encontrada com os filtros atuais.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visiveis.map(i => {
            const stKey: Status = !i.ativo ? 'desconectado' : i.ultimo_status
            const st = STATUS_BADGE[stKey]
            const iosRestrito = i.restricao_plataforma === 'ios_iap'
            const logo = BRAND_LOGO[i.chave]
            const faltando =
                parseSecretsFaltando(i.ultimo_erro)
            return (
              <div key={i.chave} className={`card flex flex-col p-5 ${i.ativo ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-silver-200">
                      {logo ? (
                        <img src={logo} alt={i.nome} className="h-7 w-7 object-contain" />
                      ) : (
                        <Settings2 className="h-5 w-5 text-navy" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-silver-900">{i.nome}</h3>
                      <p className="text-xs text-silver-500">{i.categoria}{i.provider ? ` · ${i.provider}` : ''}</p>
                    </div>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>

                {i.descricao && <p className="mt-3 text-xs text-silver-600">{i.descricao}</p>}

                {i.chave === 'serasa' && i.metricas?.verification === 'iam_authenticated' && (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Login IAM confirmado em {i.metricas.environment === 'uat' ? 'homologação' : 'produção'}. Os relatórios PF/PJ ainda não foram testados por este health check.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-500">
                  {i.eventos_24h > 0 && <span>{i.eventos_24h} eventos · 24h</span>}
                  {i.fila_pendente > 0 && <span className="text-amber-600">{i.fila_pendente} na fila</span>}
                  {i.ultimo_status === 'conectado' && typeof i.latencia_ms === 'number' && <span>{i.latencia_ms} ms</span>}
                </div>

                {/* Secrets requeridas */}
                {i.secrets_requeridas.length > 0 && (
                  <div className="mt-3 rounded-md border border-silver-100 bg-silver-50/60 p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-silver-500">
                      <KeyRound className="h-3 w-3" /> Secrets
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {i.secrets_requeridas.map(s => {
                        const missing = faltando.includes(s)
                        return (
                          <span
                            key={s}
                            title={missing ? 'Não configurada no Supabase' : 'Definida no ambiente'}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] ${
                              missing
                                ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                                : 'bg-green-50 text-green-700 ring-1 ring-green-200'
                            }`}
                          >
                            {s}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {i.ultimo_status === 'erro' && i.ultimo_erro && (
                  <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{i.ultimo_erro}</p>
                )}
                {i.ultimo_status === 'pendente' && i.ultimo_erro && faltando.length === 0 && (
                  <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">{i.ultimo_erro}</p>
                )}

                {iosRestrito && (
                  <p className="mt-3 flex items-start gap-2 rounded-md bg-silver-50 px-3 py-2 text-xs text-silver-600">
                    <Apple className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Cobrança de bens digitais restrita no app iOS (regras Apple IAP). No iPhone, recargas e
                    assinaturas são feitas pela web; Android e web seguem usando o Stripe normalmente.
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-silver-100 pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-silver-600">
                    <input
                      type="checkbox"
                      checked={i.ativo}
                      onChange={(e) => toggleMut.mutate({ chave: i.chave, ativo: e.target.checked })}
                      className="h-4 w-4 rounded border-silver-300 text-red-600 focus:ring-gold-500"
                    />
                    {i.ativo ? 'Ativa' : 'Inativa'}
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    {i.chave === 'whatsapp' && (
                      <Link to="/admin/integracoes/whatsapp" className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Configurar
                      </Link>
                    )}
                    {i.docs_url && (
                      <a href={i.docs_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-silver-500 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Docs
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => testar(i.chave)}
                      disabled={testando === i.chave || testandoTodas}
                      className="btn-no-liquid inline-flex items-center gap-1 rounded-md bg-gold-600 px-3 py-1.5 font-medium text-white hover:bg-gold-700 disabled:opacity-60"
                    >
                      {testando === i.chave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      Testar
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-silver-400">Última checagem: {tempoRelativo(i.ultima_checagem)}</p>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

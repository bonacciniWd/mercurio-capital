import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings2, Zap, ExternalLink, Apple, RefreshCw, Loader2, SlidersHorizontal,
  CheckCircle2, AlertTriangle, Clock, PowerOff, Search, KeyRound,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

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
  eventos_24h: number
  fila_pendente: number
}

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
  const qc = useQueryClient()
  const [testando, setTestando] = useState<string | null>(null)
  const [testandoTodas, setTestandoTodas] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')

  const listQuery = useQuery({
    queryKey: ['admin-integracoes-web'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_admin_integracoes').select('*')
      if (error) throw error
      return (data ?? []) as Integracao[]
    },
  })

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

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings2, Zap, ExternalLink, Apple, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react'
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

export function AdminIntegracoes() {
  const qc = useQueryClient()
  const [testando, setTestando] = useState<string | null>(null)

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

  const integracoes = listQuery.data ?? []
  const conectados = integracoes.filter(i => i.ultimo_status === 'conectado').length
  const erros = integracoes.filter(i => i.ultimo_status === 'erro').length

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Integrações externas</h1>
          <p className="mt-1 text-sm text-silver-500">
            {conectados} conectada(s){erros > 0 ? ` · ${erros} com erro` : ''} · clique em “Testar” para checar a saúde em tempo real.
          </p>
        </div>
        <button
          onClick={() => listQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-silver-200 px-3 py-2 text-sm font-medium text-silver-700 hover:bg-silver-50"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {listQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gold-600" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integracoes.map(i => {
            const st = STATUS_BADGE[i.ultimo_status]
            const iosRestrito = i.restricao_plataforma === 'ios_iap'
            const logo = BRAND_LOGO[i.chave]
            return (
              <div key={i.chave} className={`card p-5 ${i.ativo ? '' : 'opacity-60'}`}>
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
                      <p className="text-xs text-silver-500">{i.categoria}</p>
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

                {i.ultimo_status === 'erro' && i.ultimo_erro && (
                  <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{i.ultimo_erro}</p>
                )}
                {i.ultimo_status === 'pendente' && i.ultimo_erro && (
                  <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">{i.ultimo_erro}</p>
                )}

                {iosRestrito && (
                  <p className="mt-3 flex items-start gap-2 rounded-md bg-silver-50 px-3 py-2 text-xs text-silver-600">
                    <Apple className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Cobrança de bens digitais restrita no app iOS (regras Apple IAP). No iPhone, recargas e
                    assinaturas são feitas pela web; Android e web seguem usando o Stripe normalmente.
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-silver-100 pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-silver-600">
                    <input
                      type="checkbox"
                      checked={i.ativo}
                      onChange={(e) => toggleMut.mutate({ chave: i.chave, ativo: e.target.checked })}
                      className="h-4 w-4 rounded border-silver-300 text-gold-600 focus:ring-gold-500"
                    />
                    {i.ativo ? 'Ativa' : 'Inativa'}
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    {i.chave === 'whatsapp' && (
                      <Link to="/admin/integracoes/whatsapp" className="inline-flex items-center gap-1 font-medium text-gold-600 hover:underline">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Configurar
                      </Link>
                    )}
                    {i.docs_url && (
                      <a href={i.docs_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-silver-500 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Docs
                      </a>
                    )}
                    <button
                      onClick={() => testar(i.chave)}
                      disabled={testando === i.chave}
                      className="inline-flex items-center gap-1 rounded-md bg-gold-600 px-3 py-1.5 font-medium text-white hover:bg-gold-700 disabled:opacity-60"
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

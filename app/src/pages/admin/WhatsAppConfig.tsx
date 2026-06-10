import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Zap, Save, Send, Loader2, CheckCircle2, AlertTriangle, Copy, RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

type Status = 'conectado' | 'erro' | 'pendente' | 'desconectado'

interface Integracao {
  chave: string
  nome: string
  descricao: string | null
  secrets_requeridas: string[]
  docs_url: string | null
  ativo: boolean
  ultimo_status: Status
  ultima_checagem: string | null
  ultimo_erro: string | null
  latencia_ms: number | null
  configuracoes: WhatsappConfigData
  eventos_24h: number
  fila_pendente: number
}

interface WhatsappConfigData {
  numero_label?: string
  ddi_padrao?: string
  throttle_ms?: number
  idioma_template?: string
  horario_inicio?: string
  horario_fim?: string
}

interface WhatsappMsg {
  id: string
  telefone: string
  corpo: string
  status: string
  origem: string
  erro: string | null
  created_at: string
}

const STATUS_BADGE: Record<Status, { variant: 'green' | 'red' | 'yellow' | 'gray'; label: string }> = {
  conectado:    { variant: 'green',  label: 'Conectado' },
  erro:         { variant: 'red',    label: 'Erro' },
  pendente:     { variant: 'yellow', label: 'Pendente' },
  desconectado: { variant: 'gray',   label: 'Inativo' },
}

const MSG_BADGE: Record<string, 'green' | 'red' | 'yellow' | 'gray' | 'blue'> = {
  enviado: 'blue', entregue: 'green', lido: 'green', erro: 'red', pendente: 'yellow', processando: 'gray',
}

const SECRETS_COMPLETOS = [
  'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN',
]

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/whatsapp-webhook`

export function AdminWhatsAppConfig() {
  const qc = useQueryClient()
  const [cfg, setCfg] = useState<WhatsappConfigData>({})
  const [dirty, setDirty] = useState(false)
  const [testando, setTestando] = useState(false)
  const [testeTel, setTesteTel] = useState('')
  const [testeMsg, setTesteMsg] = useState('Olá! Mensagem de teste da Mercurio Capital via WhatsApp Cloud API.')
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const intQuery = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_integracoes')
        .select('*')
        .eq('chave', 'whatsapp')
        .maybeSingle()
      if (error) throw error
      return data as Integracao | null
    },
  })

  useEffect(() => {
    if (intQuery.data?.configuracoes) {
      setCfg(intQuery.data.configuracoes)
      setDirty(false)
    }
  }, [intQuery.data])

  const msgsQuery = useQuery({
    queryKey: ['whatsapp-mensagens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('id, telefone, corpo, status, origem, erro, created_at')
        .order('created_at', { ascending: false })
        .limit(15)
      if (error) throw error
      return (data ?? []) as WhatsappMsg[]
    },
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_integracao_config_set', {
        p_chave: 'whatsapp',
        p_configuracoes: cfg,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['whatsapp-config'] })
      setFeedback({ tipo: 'ok', texto: 'Configurações salvas.' })
    },
    onError: (e: Error) => setFeedback({ tipo: 'erro', texto: e.message }),
  })

  async function testarConexao() {
    setTestando(true)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('integracao-testar', {
        body: { chave: 'whatsapp' },
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['whatsapp-config'] })
      const res = data as { status: Status; erro: string | null }
      setFeedback(
        res.status === 'conectado'
          ? { tipo: 'ok', texto: 'Conexão com a WhatsApp Cloud API OK.' }
          : { tipo: 'erro', texto: res.erro ?? `Status: ${res.status}` },
      )
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Falha ao testar.' })
    } finally {
      setTestando(false)
    }
  }

  const enviarTeste = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { telefone: testeTel, corpo: testeMsg, referencia_tipo: 'teste_admin' },
      })
      if (error) throw error
      return data as { status: string; dev_mode?: boolean }
    },
    onSuccess: (data) => {
      setFeedback({
        tipo: 'ok',
        texto: data.dev_mode
          ? 'Modo dev: mensagem registrada sem envio real (credenciais ausentes).'
          : 'Mensagem enviada.',
      })
      qc.invalidateQueries({ queryKey: ['whatsapp-mensagens'] })
      qc.invalidateQueries({ queryKey: ['whatsapp-config'] })
    },
    onError: (e: Error) => setFeedback({ tipo: 'erro', texto: e.message }),
  })

  function patch(p: Partial<WhatsappConfigData>) {
    setCfg(prev => ({ ...prev, ...p }))
    setDirty(true)
  }

  function copiarWebhook() {
    navigator.clipboard.writeText(WEBHOOK_URL)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const int = intQuery.data
  const st = int ? STATUS_BADGE[int.ultimo_status] : null
  const secretsPendentes = int?.ultimo_status === 'pendente'

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/admin/integracoes" className="rounded-md p-1.5 text-silver-500 hover:bg-silver-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <img src="/brands/evolution-logo.png" alt="WhatsApp" className="h-7 w-7 rounded object-contain" />
          <h1 className="text-2xl font-bold text-navy">WhatsApp Business · Cloud API</h1>
        </div>
        {st && <Badge variant={st.variant}>{st.label}</Badge>}
      </div>

      {feedback && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {feedback.texto}
        </div>
      )}

      {intQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gold-600" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna principal */}
          <div className="space-y-6 lg:col-span-2">
            {/* Conexão */}
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-navy">Conexão</h2>
                <button onClick={testarConexao} disabled={testando} className="btn-outline h-9">
                  {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Testar conexão
                </button>
              </div>
              {secretsPendentes && (
                <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                  {int?.ultimo_erro ?? 'Credenciais ausentes.'} Configure os secrets no Supabase:
                  <code className="ml-1 font-mono">{SECRETS_COMPLETOS.join(', ')}</code>.
                </p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-silver-50 p-3">
                  <p className="text-xs text-silver-500">Eventos · 24h</p>
                  <p className="text-lg font-bold text-navy">{int?.eventos_24h ?? 0}</p>
                </div>
                <div className="rounded-lg bg-silver-50 p-3">
                  <p className="text-xs text-silver-500">Fila pendente</p>
                  <p className="text-lg font-bold text-navy">{int?.fila_pendente ?? 0}</p>
                </div>
                <div className="rounded-lg bg-silver-50 p-3">
                  <p className="text-xs text-silver-500">Latência</p>
                  <p className="text-lg font-bold text-navy">{int?.ultimo_status === 'conectado' && int?.latencia_ms != null ? `${int.latencia_ms} ms` : '—'}</p>
                </div>
              </div>
            </div>

            {/* Configurações avançadas */}
            <div className="card p-5">
              <h2 className="font-semibold text-navy">Configurações avançadas</h2>
              <p className="mt-1 text-xs text-silver-500">Parâmetros não-secretos. Token, Phone Number ID e App Secret permanecem nos secrets do Supabase.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Número (rótulo)</label>
                  <input className="input" value={cfg.numero_label ?? ''} placeholder="Mercurio Capital"
                    onChange={e => patch({ numero_label: e.target.value })} />
                </div>
                <div>
                  <label className="label">DDI padrão</label>
                  <input className="input" value={cfg.ddi_padrao ?? ''} placeholder="55"
                    onChange={e => patch({ ddi_padrao: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div>
                  <label className="label">Idioma dos templates</label>
                  <input className="input" value={cfg.idioma_template ?? ''} placeholder="pt_BR"
                    onChange={e => patch({ idioma_template: e.target.value })} />
                </div>
                <div>
                  <label className="label">Throttle entre envios (ms)</label>
                  <input className="input" type="number" min={0} value={cfg.throttle_ms ?? ''} placeholder="0"
                    onChange={e => patch({ throttle_ms: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="grid grid-cols-2 gap-2 md:col-span-2">
                  <div>
                    <label className="label">Início (envios)</label>
                    <input className="input" type="time" value={cfg.horario_inicio ?? ''}
                      onChange={e => patch({ horario_inicio: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Fim (envios)</label>
                    <input className="input" type="time" value={cfg.horario_fim ?? ''}
                      onChange={e => patch({ horario_fim: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending} className="btn-gold h-9">
                  {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </button>
              </div>
            </div>

            {/* Mensagens recentes */}
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-navy">Mensagens recentes</h2>
                <button onClick={() => msgsQuery.refetch()} className="btn-ghost h-8 px-2 text-silver-500">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-silver-500">
                    <tr><th className="py-1.5">Telefone</th><th className="py-1.5">Mensagem</th><th className="py-1.5">Origem</th><th className="py-1.5">Status</th></tr>
                  </thead>
                  <tbody>
                    {(msgsQuery.data ?? []).length === 0 ? (
                      <tr><td colSpan={4} className="py-4 text-center text-silver-400">Nenhuma mensagem ainda.</td></tr>
                    ) : (msgsQuery.data ?? []).map(m => (
                      <tr key={m.id} className="border-t border-silver-100 align-top">
                        <td className="py-2 font-mono">{m.telefone}</td>
                        <td className="py-2 max-w-[260px] truncate text-silver-600" title={m.erro ?? m.corpo}>{m.corpo}</td>
                        <td className="py-2 text-silver-500">{m.origem}</td>
                        <td className="py-2"><Badge variant={MSG_BADGE[m.status] ?? 'gray'}>{m.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            {/* Enviar teste */}
            <div className="card p-5">
              <h2 className="font-semibold text-navy">Enviar mensagem de teste</h2>
              <p className="mt-1 text-xs text-silver-500">Texto livre só é entregue dentro da janela de 24h após o cliente te responder; fora disso use templates aprovados.</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label">Telefone (com DDD)</label>
                  <input className="input" value={testeTel} placeholder="11999998888"
                    onChange={e => setTesteTel(e.target.value)} />
                </div>
                <div>
                  <label className="label">Mensagem</label>
                  <textarea className="input min-h-[90px]" value={testeMsg} onChange={e => setTesteMsg(e.target.value)} />
                </div>
                <button
                  onClick={() => enviarTeste.mutate()}
                  disabled={enviarTeste.isPending || testeTel.replace(/\D/g, '').length < 10 || !testeMsg.trim()}
                  className="btn-gold h-9 w-full"
                >
                  {enviarTeste.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </button>
              </div>
            </div>

            {/* Webhook */}
            <div className="card p-5">
              <h2 className="font-semibold text-navy">Webhook de status</h2>
              <p className="mt-1 text-xs text-silver-500">No painel da Meta (WhatsApp → Configuração → Webhook), use esta URL de callback e o seu <code className="font-mono">WHATSAPP_VERIFY_TOKEN</code>.</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-silver-200 bg-silver-50 p-2">
                <code className="flex-1 truncate text-[11px] font-mono text-silver-700">{WEBHOOK_URL}</code>
                <button onClick={copiarWebhook} className="btn-ghost h-7 px-2 text-silver-500">
                  {copiado ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Ajuda */}
            <div className="card p-5">
              <h2 className="font-semibold text-navy">Como conectar</h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-silver-600">
                <li>Siga o guia <code className="font-mono">docs/operacao/whatsapp-cloud-api-setup.md</code> (conta Meta, número, token).</li>
                <li>Defina os secrets <code className="font-mono">WHATSAPP_ACCESS_TOKEN</code>, <code className="font-mono">WHATSAPP_PHONE_NUMBER_ID</code> e os demais no Supabase.</li>
                <li>Cadastre o webhook acima no painel da Meta com o <code className="font-mono">WHATSAPP_VERIFY_TOKEN</code>.</li>
                <li>Use “Testar conexão” e depois “Enviar mensagem de teste”.</li>
              </ol>
              {int?.docs_url && (
                <a href={int.docs_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-gold-600 hover:underline">
                  Documentação WhatsApp Cloud API →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

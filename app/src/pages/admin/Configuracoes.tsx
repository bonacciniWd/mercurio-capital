import { useState, useEffect } from 'react'
import { Building2, Bell, Shield, Globe, Users, Save, TrendingUp, CheckCircle2, XCircle, Upload, Trash2, MailCheck, Loader2, Copy, Check, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { TwoFactorManager } from '@/components/TwoFactorManager'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'empresa', icon: Building2, label: 'Empresa' },
  { id: 'usuarios', icon: Users, label: 'Usuários internos' },
  { id: 'seguranca', icon: Shield, label: 'Segurança' },
  { id: 'notificacoes', icon: Bell, label: 'Notificações' },
  { id: 'teste-email', icon: MailCheck, label: 'Teste de e-mail' },
  { id: 'dominio', icon: Globe, label: 'Domínio & marca' },
  { id: 'metas', icon: TrendingUp, label: 'Metas' },
]

export function AdminConfiguracoes() {
  const [tab, setTab] = useState('empresa')
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Configurações</h1>
        <p className="text-sm text-silver-600">Parâmetros gerais da plataforma.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`btn-no-liquid flex w-full items-center justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id ? 'bg-gold/10 text-gold-700' : 'text-silver-700 hover:bg-silver-50'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </aside>

        <div className="card p-6">
          {tab === 'empresa' && <EmpresaTab />}
          {tab === 'usuarios' && <UsuariosTab />}
          {tab === 'seguranca' && <SegurancaTab />}
          {tab === 'notificacoes' && <NotificacoesTab />}
          {tab === 'teste-email' && <EmailTesteTab />}
          {tab === 'dominio' && <DominioTab />}
          {tab === 'metas' && <MetasTab />}
        </div>
      </div>
    </>
  )
}

type EquipeTesteEmail = {
  equipe_id: string
  partner_id: string
  nome: string
  parceiro_nome: string
}

type ConviteTesteResponse = {
  convite_token?: string
  email_status?: string
  email_erro?: string
  expires_in_min?: number
}

function EmailTesteTab() {
  const [equipes, setEquipes] = useState<EquipeTesteEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [equipeId, setEquipeId] = useState('')
  const [nome, setNome] = useState('Teste Operacional')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<{
    ok: boolean
    text: string
    link?: string
    emailStatus?: string
  } | null>(null)

  useEffect(() => {
    async function loadEquipes() {
      setLoading(true)
      const [equipesRes, parceirosRes] = await Promise.all([
        supabase
          .from('v_admin_partner_equipes')
          .select('equipe_id, partner_id, nome')
          .order('created_at', { ascending: true }),
        supabase
          .from('v_admin_partners')
          .select('partner_id, nome')
          .eq('status', 'approved'),
      ])

      if (equipesRes.error || parceirosRes.error) {
        setResult({
          ok: false,
          text: equipesRes.error?.message ?? parceirosRes.error?.message ?? 'Falha ao carregar equipes.',
        })
        setLoading(false)
        return
      }

      const nomes = new Map(
        ((parceirosRes.data ?? []) as { partner_id: string; nome: string }[])
          .map(parceiro => [parceiro.partner_id, parceiro.nome]),
      )
      const rows = ((equipesRes.data ?? []) as Omit<EquipeTesteEmail, 'parceiro_nome'>[])
        .filter(equipe => nomes.has(equipe.partner_id))
        .map(equipe => ({
          ...equipe,
          parceiro_nome: nomes.get(equipe.partner_id) ?? 'Parceiro',
        }))

      setEquipes(rows)
      setEquipeId(current => current || rows[0]?.equipe_id || '')
      setLoading(false)
    }

    void loadEquipes()
  }, [])

  async function handleSend() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!equipeId || !normalizedEmail || !normalizedEmail.includes('@')) {
      setResult({ ok: false, text: 'Selecione uma equipe e informe um e-mail válido.' })
      return
    }

    setSending(true)
    setResult(null)
    const { data, error } = await supabase.rpc('partner_invite_membro', {
      p_equipe_id: equipeId,
      p_email: normalizedEmail,
      p_nome: nome.trim() || 'Teste Operacional',
      p_papel_equipe: 'membro',
      p_permissoes: {},
    })
    setSending(false)

    if (error) {
      setResult({ ok: false, text: error.message })
      return
    }

    const payload = (data ?? {}) as ConviteTesteResponse
    const link = payload.convite_token
      ? `${window.location.origin}/convite/${payload.convite_token}`
      : undefined
    const enfileirado = payload.email_status === 'enfileirado'
    setResult({
      ok: enfileirado,
      text: enfileirado
        ? 'Convite criado e e-mail enfileirado. O dispatcher processará o item no próximo ciclo.'
        : `Convite criado, mas o e-mail não foi enfileirado${payload.email_erro ? `: ${payload.email_erro}` : '.'}`,
      link,
      emailStatus: payload.email_status,
    })
  }

  return (
    <>
      <div className="mb-5">
        <h2 className="font-semibold text-navy">Teste controlado de convite por e-mail</h2>
        <p className="mt-1 text-sm text-silver-500">
          Cria um convite real de membro e o enfileira pelo fluxo oficial. Use somente um endereço de teste autorizado.
        </p>
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-md border border-gold/30 bg-gold/10 p-3 text-xs text-gold-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Um novo teste invalida convites pendentes anteriores para o mesmo e-mail e equipe. O link expira em até 30 minutos.
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-silver-500">Carregando equipes…</div>
      ) : equipes.length === 0 ? (
        <div className="rounded-md border border-silver-200 p-4 text-sm text-silver-600">
          Nenhuma equipe de parceiro aprovado está disponível para o teste.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Equipe de destino</label>
            <select className="input" value={equipeId} onChange={event => { setEquipeId(event.target.value); setResult(null) }}>
              {equipes.map(equipe => (
                <option key={equipe.equipe_id} value={equipe.equipe_id}>
                  {equipe.parceiro_nome} · {equipe.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nome do convidado</label>
            <input className="input" value={nome} onChange={event => { setNome(event.target.value); setResult(null) }} />
          </div>
          <div>
            <label className="label">E-mail de teste</label>
            <input
              className="input"
              type="email"
              placeholder="teste@dominio.com.br"
              value={email}
              onChange={event => { setEmail(event.target.value); setResult(null) }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className={`mt-5 rounded-md border p-4 text-sm ${result.ok ? 'border-success/30 bg-success/5 text-success' : 'border-danger/30 bg-danger/5 text-danger'}`}>
          <p className="font-medium">{result.text}</p>
          {result.emailStatus && <p className="mt-1 text-xs">Status do enqueue: <code>{result.emailStatus}</code></p>}
          {result.link && (
            <div className="mt-3 flex items-center gap-2">
              <input className="input flex-1 font-mono text-xs" readOnly value={result.link} />
              <button
                type="button"
                className="btn-outline shrink-0"
                title="Copiar link do convite"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.link ?? '')
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}
        </div>
      )}

      {equipes.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button className="btn-gold" disabled={sending || !equipeId || !email.trim()} onClick={() => void handleSend()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
            {sending ? 'Criando convite…' : 'Criar convite de teste'}
          </button>
        </div>
      )}
    </>
  )
}

function EmpresaTab() {
  const [form, setForm] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '',
    endereco: '', email: '', telefone: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'empresa')
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.valor as Partial<typeof form> | null
        if (v) setForm(f => ({ ...f, ...v }))
      })
  }, [])

  function set<K extends keyof typeof form>(k: K, val: string) {
    setForm(f => ({ ...f, [k]: val }))
    setMsg(null)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('configuracoes_sistema')
      .upsert({ chave: 'empresa', valor: form }, { onConflict: 'chave' })
    setSaving(false)
    if (error) setMsg({ ok: false, text: error.message })
    else {
      setMsg({ ok: true, text: 'Dados da empresa salvos.' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  return (
    <>
      <h2 className="mb-5 font-semibold text-navy">Dados da empresa</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label">Razão social</label><input className="input" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} /></div>
        <div><label className="label">Nome fantasia</label><input className="input" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} /></div>
        <div><label className="label">CNPJ</label><input className="input font-mono" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" /></div>
        <div><label className="label">Inscrição estadual</label><input className="input" value={form.inscricao_estadual} onChange={e => set('inscricao_estadual', e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">Endereço</label><input className="input" value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Av. Paulista, 1000 — São Paulo/SP" /></div>
        <div><label className="label">E-mail de contato</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@mercuriocapitalsa.com.br" /></div>
        <div><label className="label">Telefone</label><input className="input" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(11) 3000-0000" /></div>
      </div>
      {msg && <p className={`mt-4 text-sm font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      <div className="mt-6 flex justify-end">
        <button className="btn-gold" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </>
  )
}

type AdminUserRow = {
  id: string
  nome_completo: string
  email: string
  ativo: boolean
  ultimo_login_at: string | null
  created_at: string
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 0) return d.toLocaleString('pt-BR')
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const dias = Math.floor(h / 24)
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return d.toLocaleDateString('pt-BR')
}

function UsuariosTab() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setError(null)
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome_completo, email, ativo, ultimo_login_at, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
    if (error) {
      setError(error.message)
      setUsers([])
    } else {
      setUsers((data ?? []) as AdminUserRow[])
    }
  }

  useEffect(() => { void load() }, [])

  async function toggleAtivo(u: AdminUserRow) {
    setBusyId(u.id)
    const { error } = await supabase
      .from('usuarios')
      .update({ ativo: !u.ativo })
      .eq('id', u.id)
    setBusyId(null)
    if (error) { setError(error.message); return }
    setUsers(list => (list ?? []).map(x => x.id === u.id ? { ...x, ativo: !x.ativo } : x))
  }

  return (
    <>
      <div className="mb-5">
        <h2 className="font-semibold text-navy">Usuários internos</h2>
        <p className="text-xs text-silver-500">
          Administradores da plataforma (role <code className="font-mono">admin</code>). O cadastro é feito diretamente no banco via SQL.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>
      )}

      {users === null ? (
        <div className="py-10 text-center text-sm text-silver-500">Carregando…</div>
      ) : users.length === 0 ? (
        <div className="py-10 text-center text-sm text-silver-500">Nenhum administrador encontrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-silver-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-silver-900">{u.nome_completo}</p>
                    <p className="text-xs text-silver-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.ativo ? 'green' : 'gray'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-silver-600">{formatRelative(u.ultimo_login_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void toggleAtivo(u)}
                      disabled={busyId === u.id}
                      className="btn-no-liquid inline-flex items-center gap-1 rounded-md border border-silver-300 bg-white px-2.5 py-1 text-xs font-medium text-silver-700 hover:bg-silver-50 disabled:opacity-50"
                      title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                    >
                      {u.ativo
                        ? <><XCircle className="h-3.5 w-3.5 text-danger" /> Desativar</>
                        : <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Reativar</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function SegurancaTab() {
  const [senhaMin, setSenhaMin] = useState('')
  const [idleAdmin, setIdleAdmin] = useState('')
  const [idleGeral, setIdleGeral] = useState('')
  const [rlMax, setRlMax] = useState('')
  const [rlJanela, setRlJanela] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('configuracoes_sistema')
      .select('chave, valor')
      .in('chave', ['senha_min_length', 'sessao_idle_admin_min', 'sessao_idle_geral_min', 'rate_limit_login'])
      .then(({ data }) => {
        const map: Record<string, unknown> = {}
        for (const r of (data ?? []) as { chave: string; valor: unknown }[]) {
          map[r.chave] = r.valor
        }
        const num = (v: unknown) => String(v ?? '').replace(/\D/g, '')
        setSenhaMin(num(map['senha_min_length']) || '8')
        setIdleAdmin(num(map['sessao_idle_admin_min']) || '30')
        setIdleGeral(num(map['sessao_idle_geral_min']) || '480')
        const rl = (map['rate_limit_login'] ?? {}) as { max?: number; janela_min?: number }
        setRlMax(String(rl.max ?? 5))
        setRlJanela(String(rl.janela_min ?? 15))
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    const sm = Number(senhaMin), ia = Number(idleAdmin), ig = Number(idleGeral)
    const rm = Number(rlMax), rj = Number(rlJanela)
    if ([sm, ia, ig, rm, rj].some(n => isNaN(n) || n <= 0)) {
      setMsg({ ok: false, text: 'Preencha valores numéricos positivos.' })
      return
    }
    if (sm < 6) {
      setMsg({ ok: false, text: 'O mínimo de senha não pode ser menor que 6.' })
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('configuracoes_sistema')
      .upsert([
        { chave: 'senha_min_length', valor: sm },
        { chave: 'sessao_idle_admin_min', valor: ia },
        { chave: 'sessao_idle_geral_min', valor: ig },
        { chave: 'rate_limit_login', valor: { max: rm, janela_min: rj } },
      ], { onConflict: 'chave' })
    setSaving(false)
    if (error) setMsg({ ok: false, text: error.message })
    else {
      setMsg({ ok: true, text: 'Políticas de segurança salvas.' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-silver-500">Carregando…</div>

  return (
    <>
      <h2 className="mb-1 font-semibold text-navy">Políticas de segurança</h2>
      <p className="mb-6 text-sm text-silver-500">Aplicadas de fato pelo sistema (web e mobile).</p>

      <div className="space-y-6">
        {/* Senha */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-silver-700">Senha</h3>
          <div className="max-w-xs">
            <label className="label">Tamanho mínimo de senha</label>
            <input className="input" type="number" min={6} value={senhaMin}
              onChange={e => { setSenhaMin(e.target.value); setMsg(null) }} />
            <p className="mt-1 text-xs text-silver-400">Validado em cadastros, redefinição e onboarding (web e app).</p>
          </div>
        </div>

        {/* Sessão */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-silver-700">Sessão (logout automático por inatividade)</h3>
          <div className="grid max-w-md gap-4 md:grid-cols-2">
            <div>
              <label className="label">Admin (minutos)</label>
              <input className="input" type="number" min={1} value={idleAdmin}
                onChange={e => { setIdleAdmin(e.target.value); setMsg(null) }} />
            </div>
            <div>
              <label className="label">Demais perfis (minutos)</label>
              <input className="input" type="number" min={1} value={idleGeral}
                onChange={e => { setIdleGeral(e.target.value); setMsg(null) }} />
            </div>
          </div>
          <p className="mt-1 text-xs text-silver-400">Encerra a sessão após o período sem atividade.</p>
        </div>

        {/* Rate limit de login */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-silver-700">Rate limit de login</h3>
          <div className="grid max-w-md gap-4 md:grid-cols-2">
            <div>
              <label className="label">Máx. tentativas falhas</label>
              <input className="input" type="number" min={1} value={rlMax}
                onChange={e => { setRlMax(e.target.value); setMsg(null) }} />
            </div>
            <div>
              <label className="label">Janela (minutos)</label>
              <input className="input" type="number" min={1} value={rlJanela}
                onChange={e => { setRlJanela(e.target.value); setMsg(null) }} />
            </div>
          </div>
          <p className="mt-1 text-xs text-silver-400">Bloqueia logins após muitas tentativas falhas (por e-mail; por IP usa 3× o limite).</p>
        </div>

        {/* 2FA — aplicado pelo backend */}
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="green">Ativo</Badge>
            <h3 className="text-sm font-semibold text-silver-800">2FA obrigatório para admins</h3>
          </div>
          <p className="mt-1 text-xs text-silver-600">
            Exigido pelo servidor: ações sensíveis de admin e parceiro aprovado são bloqueadas por RLS sem 2FA verificado
            (<code className="font-mono">app_requires_2fa()</code>). Configure seu autenticador abaixo.
          </p>
        </div>

        {/* Auditoria — automática */}
        <div className="rounded-lg border border-silver-200 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="navy">Automático</Badge>
            <h3 className="text-sm font-semibold text-silver-800">Auditoria de ações</h3>
          </div>
          <p className="mt-1 text-xs text-silver-600">
            Alterações em propostas, contratos, comissões, parceiros e configurações são registradas em <code className="font-mono">audit_log</code> por triggers.
          </p>
        </div>
      </div>

      {msg && <p className={`mt-4 text-sm font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      <div className="mt-4 flex justify-end">
        <button className="btn-gold" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar políticas'}
        </button>
      </div>

      <div className="mt-8 rounded-lg border border-silver-200 p-5">
        <TwoFactorManager />
      </div>
    </>
  )
}

type Canal = 'email' | 'whatsapp' | 'push'
type NotifPrefs = Record<string, Record<Canal, boolean>>

const NOTIF_EVENTS: { key: string; label: string; defaults: Record<Canal, boolean> }[] = [
  { key: 'parceiro_novo',        label: 'Novo parceiro cadastrado',    defaults: { email: true,  whatsapp: false, push: true  } },
  { key: 'wallet_saldo_baixo',   label: 'Saldo de carteira < R$ 50',   defaults: { email: true,  whatsapp: false, push: true  } },
  { key: 'proposta_parada_7d',   label: 'Proposta parada > 7 dias',    defaults: { email: true,  whatsapp: false, push: true  } },
  { key: 'integracao_erro',      label: 'Erro em integração externa',  defaults: { email: true,  whatsapp: false, push: true  } },
  { key: 'webhook_falha',        label: 'Falha de webhook',            defaults: { email: true,  whatsapp: false, push: true  } },
  { key: 'auditoria_critica',    label: 'Nova auditoria crítica',      defaults: { email: true,  whatsapp: false, push: true  } },
]

function defaultPrefs(): NotifPrefs {
  const out: NotifPrefs = {}
  for (const e of NOTIF_EVENTS) out[e.key] = { ...e.defaults }
  return out
}

function NotificacoesTab() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'notificacoes_admin')
      .maybeSingle()
      .then(({ data }) => {
        const base = defaultPrefs()
        const stored = (data?.valor ?? null) as NotifPrefs | null
        if (stored) {
          for (const k of Object.keys(base)) {
            if (stored[k]) base[k] = { ...base[k], ...stored[k] }
          }
        }
        setPrefs(base)
      })
  }, [])

  function toggle(evKey: string, canal: Canal) {
    setPrefs(p => p && ({ ...p, [evKey]: { ...p[evKey], [canal]: !p[evKey][canal] } }))
    setMsg(null)
  }

  async function handleSave() {
    if (!prefs) return
    setSaving(true)
    const { error } = await supabase
      .from('configuracoes_sistema')
      .upsert({ chave: 'notificacoes_admin', valor: prefs }, { onConflict: 'chave' })
    setSaving(false)
    if (error) setMsg({ ok: false, text: error.message })
    else {
      setMsg({ ok: true, text: 'Preferências salvas.' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  if (!prefs) return <div className="py-10 text-center text-sm text-silver-500">Carregando…</div>

  return (
    <>
      <h2 className="mb-1 font-semibold text-navy">Preferências de notificação</h2>
      <p className="mb-5 text-sm text-silver-500">Aplicadas às notificações administrativas da plataforma.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="py-2">Evento</th>
              <th className="py-2 text-center">E-mail</th>
              <th className="py-2 text-center">WhatsApp</th>
              <th className="py-2 text-center">Push</th>
            </tr>
          </thead>
          <tbody>
            {NOTIF_EVENTS.map(ev => (
              <tr key={ev.key} className="border-t border-silver-100">
                <td className="py-3 text-silver-800">{ev.label}</td>
                {(['email', 'whatsapp', 'push'] as Canal[]).map(c => (
                  <td key={c} className="py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-gold"
                      checked={prefs[ev.key][c]}
                      onChange={() => toggle(ev.key, c)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className={`mt-4 text-sm font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      <div className="mt-6 flex justify-end">
        <button className="btn-gold" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar preferências'}
        </button>
      </div>
    </>
  )
}

type DominioMarca = {
  dominio: string
  status_cname: string
  cor_primaria: string
  cor_destaque: string
  logo_url: string
  logo_path: string
}

const DOMINIO_DEFAULT: DominioMarca = {
  dominio: 'mercuriocapitalsa.com.br',
  status_cname: 'status.mercuriocapitalsa.com.br',
  cor_primaria: '#0A2B4E',
  cor_destaque: '#D4AF37',
  logo_url: '',
  logo_path: '',
}

const LOGO_BUCKET = 'milestone-images'
const LOGO_PREFIX = 'platform-logo'
const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

function DominioTab() {
  const [form, setForm] = useState<DominioMarca | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'dominio_marca')
      .maybeSingle()
      .then(({ data }) => {
        const v = (data?.valor ?? null) as Partial<DominioMarca> | null
        setForm({ ...DOMINIO_DEFAULT, ...(v ?? {}) })
      })
  }, [])

  function set<K extends keyof DominioMarca>(k: K, val: DominioMarca[K]) {
    setForm(f => f && ({ ...f, [k]: val }))
    setMsg(null)
  }

  async function persist(next: DominioMarca) {
    const { error } = await supabase
      .from('configuracoes_sistema')
      .upsert({ chave: 'dominio_marca', valor: next }, { onConflict: 'chave' })
    return error
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reenviar mesmo arquivo
    if (!file || !form) return
    if (!LOGO_MIMES.includes(file.type)) {
      setMsg({ ok: false, text: 'Formato inválido. Use PNG, JPEG, WEBP ou SVG.' })
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setMsg({ ok: false, text: 'Arquivo maior que 2 MB.' })
      return
    }
    setUploading(true)
    setMsg(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${LOGO_PREFIX}/logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
    if (upErr) {
      setUploading(false)
      setMsg({ ok: false, text: upErr.message })
      return
    }
    // Remove logo anterior, se houver
    if (form.logo_path && form.logo_path !== path) {
      await supabase.storage.from(LOGO_BUCKET).remove([form.logo_path])
    }
    const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
    const next: DominioMarca = { ...form, logo_url: pub.publicUrl, logo_path: path }
    const err = await persist(next)
    setUploading(false)
    if (err) setMsg({ ok: false, text: err.message })
    else {
      setForm(next)
      setMsg({ ok: true, text: 'Logo atualizado.' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function handleLogoRemove() {
    if (!form || !form.logo_path) return
    setUploading(true)
    await supabase.storage.from(LOGO_BUCKET).remove([form.logo_path])
    const next: DominioMarca = { ...form, logo_url: '', logo_path: '' }
    const err = await persist(next)
    setUploading(false)
    if (err) setMsg({ ok: false, text: err.message })
    else {
      setForm(next)
      setMsg({ ok: true, text: 'Logo removido.' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    const err = await persist(form)
    setSaving(false)
    if (err) setMsg({ ok: false, text: err.message })
    else {
      setMsg({ ok: true, text: 'Configurações de marca salvas.' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  if (!form) return <div className="py-10 text-center text-sm text-silver-500">Carregando…</div>

  return (
    <>
      <h2 className="mb-5 font-semibold text-navy">Domínio e identidade visual</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Domínio principal</label>
          <input className="input" value={form.dominio} onChange={e => set('dominio', e.target.value)} />
        </div>
        <div>
          <label className="label">URL de status (CNAME)</label>
          <input className="input" value={form.status_cname} onChange={e => set('status_cname', e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <label className="label">Logo (light)</label>
          <div className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-silver-300 p-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-md border border-silver-200 bg-silver-50">
              {form.logo_url
                ? <img src={form.logo_url} alt="Logo atual" className="max-h-full max-w-full object-contain" />
                : <span className="text-xs text-silver-400">sem logo</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-silver-700">Envie a logo da plataforma</p>
              <p className="text-xs text-silver-500">PNG, JPEG, WEBP ou SVG · máx. 2 MB</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="btn-no-liquid inline-flex cursor-pointer items-center gap-2 rounded-lg border border-silver-300 bg-white px-3 py-2 text-sm font-medium text-silver-700 hover:bg-silver-50">
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Enviando…' : (form.logo_url ? 'Substituir' : 'Selecionar arquivo')}
                  <input
                    type="file"
                    accept={LOGO_MIMES.join(',')}
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                </label>
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={() => void handleLogoRemove()}
                    disabled={uploading}
                    className="btn-no-liquid inline-flex items-center gap-2 rounded-lg border border-danger/30 bg-white px-3 py-2 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="label">Cor primária</label>
          <input className="input h-11 p-1" type="color" value={form.cor_primaria} onChange={e => set('cor_primaria', e.target.value)} />
        </div>
        <div>
          <label className="label">Cor de destaque</label>
          <input className="input h-11 p-1" type="color" value={form.cor_destaque} onChange={e => set('cor_destaque', e.target.value)} />
        </div>
      </div>
      {msg && <p className={`mt-4 text-sm font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      <div className="mt-6 flex justify-end">
        <button className="btn-gold" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </>
  )
}

function MetasTab() {
  const [centavos, setCentavos] = useState<number | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'meta_volume_mensal')
      .maybeSingle()
      .then(({ data }) => {
        const c = (data?.valor as { centavos: number } | null)?.centavos ?? 50_000_000_000
        setCentavos(c)
        setInputVal(String(Math.round(c / 100)))
      })
  }, [])

  async function handleSave() {
    const reais = Number(inputVal.replace(/\./g, '').replace(',', '.'))
    if (isNaN(reais) || reais <= 0) {
      setMsg({ ok: false, text: 'Valor inválido.' })
      return
    }
    setSaving(true)
    const novoCentavos = Math.round(reais * 100)
    const { error } = await supabase
      .from('configuracoes_sistema')
      .upsert(
        { chave: 'meta_volume_mensal', valor: { centavos: novoCentavos } },
        { onConflict: 'chave' }
      )
    setSaving(false)
    if (error) {
      setMsg({ ok: false, text: error.message })
    } else {
      setCentavos(novoCentavos)
      setMsg({ ok: true, text: 'Meta atualizada com sucesso.' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const valorAtual = centavos !== null
    ? (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—'

  return (
    <>
      <h2 className="mb-1 font-semibold text-navy">Metas do dashboard</h2>
      <p className="mb-6 text-sm text-silver-500">Define a barra de progresso de volume ganho no backoffice mobile e web.</p>
      <div className="max-w-sm space-y-4">
        <div>
          <label className="label">Meta de volume mensal (R$)</label>
          <input
            className="input font-mono"
            placeholder="500000000"
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); setMsg(null) }}
          />
          <p className="mt-1 text-xs text-silver-400">Valor atual: <span className="font-semibold text-silver-700">{valorAtual}</span></p>
        </div>
        {msg && (
          <p className={`text-sm font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>
        )}
        <button className="btn-gold" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar meta'}
        </button>
      </div>
    </>
  )
}

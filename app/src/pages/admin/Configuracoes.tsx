import { useState, useEffect } from 'react'
import { Building2, Bell, Shield, Globe, Users, Database, Save, Plus, Trash2, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { TwoFactorManager } from '@/components/TwoFactorManager'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'empresa', icon: Building2, label: 'Empresa' },
  { id: 'usuarios', icon: Users, label: 'Usuários internos' },
  { id: 'seguranca', icon: Shield, label: 'Segurança' },
  { id: 'notificacoes', icon: Bell, label: 'Notificações' },
  { id: 'dominio', icon: Globe, label: 'Domínio & marca' },
  { id: 'backup', icon: Database, label: 'Backup' },
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
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id ? 'bg-gold/10 text-gold-700' : 'text-silver-700 hover:bg-silver-50'
              }`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </aside>

        <div className="card p-6">
          {tab === 'empresa' && <EmpresaTab />}
          {tab === 'usuarios' && <UsuariosTab />}
          {tab === 'seguranca' && <SegurancaTab />}
          {tab === 'notificacoes' && <NotificacoesTab />}
          {tab === 'dominio' && <DominioTab />}
          {tab === 'backup' && <BackupTab />}
          {tab === 'metas' && <MetasTab />}
        </div>
      </div>
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
        <div><label className="label">E-mail de contato</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@mercuriocapital.com.br" /></div>
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

function UsuariosTab() {
  const users = [
    { nome: 'Admin Master', email: 'admin@mercurio.com', role: 'Super Admin', last: 'agora' },
    { nome: 'Mariana Costa', email: 'mariana@mercurio.com', role: 'Admin', last: 'há 1h' },
    { nome: 'Roberto S.', email: 'roberto@mercurio.com', role: 'Analista', last: 'há 2 dias' },
    { nome: 'Juliana M.', email: 'juliana@mercurio.com', role: 'Operação', last: 'ontem' },
  ]
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold text-navy">Usuários internos</h2>
        <button className="btn-gold"><Plus className="h-4 w-4" /> Adicionar usuário</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
          <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Permissão</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3"></th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.email} className="border-t border-silver-100">
              <td className="px-4 py-3"><p className="font-medium">{u.nome}</p><p className="text-xs text-silver-500">{u.email}</p></td>
              <td className="px-4 py-3"><Badge variant={u.role === 'Super Admin' ? 'navy' : 'gray'}>{u.role}</Badge></td>
              <td className="px-4 py-3 text-silver-600">{u.last}</td>
              <td className="px-4 py-3"><button className="rounded-md p-1.5 hover:bg-danger/10"><Trash2 className="h-4 w-4 text-danger" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
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

function NotificacoesTab() {
  const events = [
    'Novo parceiro cadastrado', 'Saldo de carteira < R$ 50', 'Proposta parada > 7 dias',
    'Erro em integração externa', 'Falha de webhook', 'Nova auditoria crítica',
  ]
  return (
    <>
      <h2 className="mb-5 font-semibold text-navy">Preferências de notificação</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-silver-500">
          <tr><th className="py-2">Evento</th><th className="py-2 text-center">E-mail</th><th className="py-2 text-center">WhatsApp</th><th className="py-2 text-center">Push</th></tr>
        </thead>
        <tbody>
          {events.map(e => (
            <tr key={e} className="border-t border-silver-100">
              <td className="py-3 text-silver-800">{e}</td>
              <td className="py-3 text-center"><input type="checkbox" defaultChecked className="h-4 w-4 accent-gold" /></td>
              <td className="py-3 text-center"><input type="checkbox" className="h-4 w-4 accent-gold" /></td>
              <td className="py-3 text-center"><input type="checkbox" defaultChecked className="h-4 w-4 accent-gold" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function DominioTab() {
  return (
    <>
      <h2 className="mb-5 font-semibold text-navy">Domínio e identidade visual</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label">Domínio principal</label><input className="input" defaultValue="app.mercuriocapital.com.br" /></div>
        <div><label className="label">URL de status (CNAME)</label><input className="input" defaultValue="status.mercuriocapital.com.br" /></div>
        <div className="md:col-span-2">
          <label className="label">Logo (light)</label>
          <div className="rounded-lg border-2 border-dashed border-silver-300 p-8 text-center text-sm text-silver-500">Arraste o arquivo SVG/PNG ou clique para enviar</div>
        </div>
        <div><label className="label">Cor primária</label><input className="input" type="color" defaultValue="#0A2B4E" /></div>
        <div><label className="label">Cor de destaque</label><input className="input" type="color" defaultValue="#D4AF37" /></div>
      </div>
      <div className="mt-6 flex justify-end"><button className="btn-gold"><Save className="h-4 w-4" /> Salvar</button></div>
    </>
  )
}

function BackupTab() {
  return (
    <>
      <h2 className="mb-5 font-semibold text-navy">Backup e retenção</h2>
      <div className="space-y-4">
        <div className="rounded-lg bg-success/5 border border-success/30 p-4 text-sm">
          <p className="font-semibold text-success">Último backup: hoje, 03:00</p>
          <p className="text-silver-700">Tamanho: 2.4 GB · Duração: 4 min · Status: OK</p>
        </div>
        <Toggle label="Backup diário automático" desc="03:00 (UTC-3)" defaultChecked />
        <Toggle label="Backup incremental a cada 6h" desc="Reduz janela de perda em caso de falha" defaultChecked />
        <div><label className="label">Retenção (dias)</label><input className="input w-40" type="number" defaultValue={90} /></div>
        <div><label className="label">Local de armazenamento</label><select className="input"><option>S3 (us-east-1)</option><option>S3 (sa-east-1)</option></select></div>
      </div>
      <div className="mt-6 flex justify-between">
        <button className="btn-outline">Restaurar de backup</button>
        <button className="btn-gold"><Save className="h-4 w-4" /> Salvar</button>
      </div>
    </>
  )
}

function Toggle({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-silver-200 p-4">
      <div>
        <p className="text-sm font-semibold text-silver-900">{label}</p>
        <p className="text-xs text-silver-500">{desc}</p>
      </div>
      <input type="checkbox" defaultChecked={defaultChecked} className="peer sr-only" />
      <div className="peer h-6 w-11 rounded-full bg-silver-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white peer-checked:bg-success peer-checked:after:translate-x-5 relative" />
    </label>
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

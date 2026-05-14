import { useState } from 'react'
import { Building2, Bell, Shield, Globe, Users, Database, Save, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { TwoFactorManager } from '@/components/TwoFactorManager'

const TABS = [
  { id: 'empresa', icon: Building2, label: 'Empresa' },
  { id: 'usuarios', icon: Users, label: 'Usuários internos' },
  { id: 'seguranca', icon: Shield, label: 'Segurança' },
  { id: 'notificacoes', icon: Bell, label: 'Notificações' },
  { id: 'dominio', icon: Globe, label: 'Domínio & marca' },
  { id: 'backup', icon: Database, label: 'Backup' },
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
        </div>
      </div>
    </>
  )
}

function EmpresaTab() {
  return (
    <>
      <h2 className="mb-5 font-semibold text-navy">Dados da empresa</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label">Razão social</label><input className="input" defaultValue="Mercurio Capital LTDA" /></div>
        <div><label className="label">Nome fantasia</label><input className="input" defaultValue="Mercurio Capital" /></div>
        <div><label className="label">CNPJ</label><input className="input font-mono" defaultValue="00.000.000/0001-00" /></div>
        <div><label className="label">Inscrição estadual</label><input className="input" defaultValue="Isento" /></div>
        <div className="md:col-span-2"><label className="label">Endereço</label><input className="input" defaultValue="Av. Paulista, 1000 — São Paulo/SP" /></div>
        <div><label className="label">E-mail de contato</label><input className="input" type="email" defaultValue="contato@mercurio.com.br" /></div>
        <div><label className="label">Telefone</label><input className="input" defaultValue="(11) 3000-0000" /></div>
      </div>
      <div className="mt-6 flex justify-end"><button className="btn-gold"><Save className="h-4 w-4" /> Salvar</button></div>
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
  return (
    <>
      <h2 className="mb-5 font-semibold text-navy">Políticas de segurança</h2>
      <div className="space-y-4">
        <Toggle label="Exigir 2FA para todos os admins" desc="Autenticação em dois fatores via TOTP" defaultChecked />
        <Toggle label="Bloquear após 5 tentativas falhadas" desc="Bloqueio temporário de 30 minutos" defaultChecked />
        <Toggle label="Sessão expira em 8 horas" desc="Token de acesso renovado automaticamente" defaultChecked />
        <Toggle label="Logar todas as ações administrativas" desc="Audit log automático" defaultChecked />
        <div className="grid gap-4 pt-4 md:grid-cols-2">
          <div><label className="label">Tamanho mínimo de senha</label><input className="input" type="number" defaultValue={12} /></div>
          <div><label className="label">IPs permitidos (whitelist)</label><input className="input font-mono" placeholder="0.0.0.0/0 (todos)" /></div>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-silver-200 p-5">
        <TwoFactorManager />
      </div>

      <div className="mt-6 flex justify-end"><button className="btn-gold"><Save className="h-4 w-4" /> Salvar políticas</button></div>
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

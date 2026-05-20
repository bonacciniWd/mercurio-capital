import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Send, Loader2, X, AlertCircle, Save, Trash2, Mail, Bell, MessageSquare,
  CalendarClock, CheckCircle2, Edit2,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

type Canal = 'in_app' | 'email' | 'whatsapp' | 'push'
type Status = 'rascunho' | 'agendada' | 'enviada' | 'cancelada'

interface PublicoAlvo {
  roles?: string[]
  partner_ids?: string[]
}

interface Campanha {
  id: string
  nome: string
  publico_alvo: PublicoAlvo
  canais: Canal[]
  template: string
  agendado_para: string | null
  status: Status
  metricas: { in_app?: number; email_enfileirados?: number; disparado_em?: string }
  created_at: string
  updated_at: string
  created_by_nome: string | null
}

interface TemplateMin {
  id: string
  codigo: string
  canal: Canal
  nome: string
}

const STATUS_VAR: Record<Status, 'gray' | 'amber' | 'green' | 'red'> = {
  rascunho: 'gray', agendada: 'amber', enviada: 'green', cancelada: 'red',
}
const STATUS_LBL: Record<Status, string> = {
  rascunho: 'Rascunho', agendada: 'Agendada', enviada: 'Enviada', cancelada: 'Cancelada',
}
const CANAL_ICON: Record<Canal, React.ElementType> = {
  in_app: Bell, email: Mail, whatsapp: MessageSquare, push: Mail,
}

function emptyDraft(): Partial<Campanha> {
  return {
    nome: '', publico_alvo: { roles: ['partner'] }, canais: ['in_app'],
    template: '', agendado_para: null, status: 'rascunho',
  }
}

export function AdminCampanhas() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Campanha> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmDispatch, setConfirmDispatch] = useState<Campanha | null>(null)

  const campQuery = useQuery({
    queryKey: ['admin-campanhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_campanhas').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Campanha[]
    },
  })
  const campanhas = campQuery.data ?? []

  const templatesQuery = useQuery({
    queryKey: ['admin-templates-min'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_templates').select('id,codigo,canal,nome').eq('ativo', true)
      if (error) throw error
      return (data ?? []) as TemplateMin[]
    },
  })
  const templates = templatesQuery.data ?? []

  const upsertMut = useMutation({
    mutationFn: async (c: Partial<Campanha>) => {
      const { data, error } = await supabase.rpc('admin_campanha_upsert', {
        p_nome: c.nome,
        p_template: c.template,
        p_id: c.id ?? null,
        p_publico_alvo: c.publico_alvo ?? {},
        p_canais: c.canais ?? ['in_app'],
        p_agendado_para: c.agendado_para ?? null,
        p_status: c.status ?? 'rascunho',
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-campanhas'] })
      setEditing(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const cancelarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_campanha_cancelar', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-campanhas'] }),
    onError: (e: Error) => setErro(e.message),
  })

  const dispararMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('admin_campanha_disparar', { p_id: id })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-campanhas'] })
      setConfirmDispatch(null)
    },
    onError: (e: Error) => { setErro(e.message); setConfirmDispatch(null) },
  })

  function toggleCanal(c: Canal) {
    setEditing(s => {
      if (!s) return s
      const canais = s.canais ?? []
      return { ...s, canais: canais.includes(c) ? canais.filter(x => x !== c) : [...canais, c] }
    })
  }
  function toggleRole(r: string) {
    setEditing(s => {
      if (!s) return s
      const roles = s.publico_alvo?.roles ?? []
      const next = roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r]
      return { ...s, publico_alvo: { ...(s.publico_alvo ?? {}), roles: next } }
    })
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Campanhas de comunicação</h1>
          <p className="text-sm text-silver-500">Dispara notificações in-app e e-mails para públicos segmentados.</p>
        </div>
        <button className="btn-gold" onClick={() => setEditing(emptyDraft())}>
          <Plus className="h-4 w-4" /> Nova campanha
        </button>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {campQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-silver-500" /></div>
        ) : campanhas.length === 0 ? (
          <div className="p-10 text-center text-silver-500">Nenhuma campanha cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Canais</th>
                <th className="px-5 py-3">Público</th>
                <th className="px-5 py-3 text-right">Métricas</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Quando</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map(c => (
                <tr key={c.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-silver-900">{c.nome}</div>
                    <div className="text-xs text-silver-500"><code>{c.template}</code></div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {c.canais.map(k => {
                        const I = CANAL_ICON[k]
                        return <span key={k} className="inline-flex items-center gap-1 rounded-md bg-silver-100 px-2 py-1 text-xs"><I className="h-3 w-3" /> {k}</span>
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-silver-700">
                    {(c.publico_alvo?.roles ?? []).length > 0
                      ? `Roles: ${c.publico_alvo!.roles!.join(', ')}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-silver-600">
                    {c.status === 'enviada' ? (
                      <>
                        <div>in-app: <b>{c.metricas?.in_app ?? 0}</b></div>
                        <div>e-mail: <b>{c.metricas?.email_enfileirados ?? 0}</b></div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3"><Badge variant={STATUS_VAR[c.status]}>{STATUS_LBL[c.status]}</Badge></td>
                  <td className="px-5 py-3 text-xs text-silver-700">
                    {c.metricas?.disparado_em
                      ? new Date(c.metricas.disparado_em).toLocaleString('pt-BR')
                      : c.agendado_para
                        ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {new Date(c.agendado_para).toLocaleString('pt-BR')}</span>
                        : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.status === 'rascunho' || c.status === 'agendada' ? (
                      <>
                        <button className="btn-ghost h-7 px-2" onClick={() => setEditing({ ...c })} title="Editar">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-ghost h-7 px-2 text-success" onClick={() => setConfirmDispatch(c)} title="Disparar">
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-ghost h-7 px-2 text-red-600" onClick={() => cancelarMut.mutate(c.id)} title="Cancelar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-silver-200 px-5 py-3">
              <h2 className="font-semibold text-navy">
                {editing.id ? 'Editar campanha' : 'Nova campanha'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-silver-500 hover:text-navy">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={editing.nome ?? ''}
                  onChange={e => setEditing(s => ({ ...s!, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label">Template</label>
                <select className="input" value={editing.template ?? ''}
                  onChange={e => setEditing(s => ({ ...s!, template: e.target.value }))}>
                  <option value="">— escolha —</option>
                  {templates.map(t => <option key={t.codigo} value={t.codigo}>{t.nome} ({t.canal}) [{t.codigo}]</option>)}
                </select>
              </div>
              <div>
                <label className="label">Canais</label>
                <div className="flex gap-2">
                  {(['in_app', 'email'] as Canal[]).map(k => {
                    const on = (editing.canais ?? []).includes(k)
                    const Icon = CANAL_ICON[k]
                    return (
                      <button key={k} type="button" onClick={() => toggleCanal(k)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-gold bg-gold/10 text-gold-700' : 'border-silver-300 text-silver-600'}`}>
                        <Icon className="h-4 w-4" /> {k}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="label">Público (roles)</label>
                <div className="flex gap-2">
                  {['admin', 'partner', 'team_member', 'client'].map(r => {
                    const on = (editing.publico_alvo?.roles ?? []).includes(r)
                    return (
                      <button key={r} type="button" onClick={() => toggleRole(r)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-gold bg-gold/10 text-gold-700' : 'border-silver-300 text-silver-600'}`}>
                        {r}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-silver-500">Vazio = todos os usuários ativos.</p>
              </div>
              <div>
                <label className="label">Agendar para (opcional)</label>
                <input type="datetime-local" className="input"
                  value={editing.agendado_para ? editing.agendado_para.slice(0, 16) : ''}
                  onChange={e => setEditing(s => ({ ...s!, agendado_para: e.target.value ? new Date(e.target.value).toISOString() : null, status: e.target.value ? 'agendada' : 'rascunho' }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-silver-200 px-5 py-3">
              <button className="btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-gold" onClick={() => editing && upsertMut.mutate(editing)}
                disabled={upsertMut.isPending || !editing.nome || !editing.template}>
                {upsertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* dispatch confirm */}
      {confirmDispatch && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <Send className="h-6 w-6 text-gold mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-navy">Disparar "{confirmDispatch.nome}"?</h3>
                <p className="mt-1 text-sm text-silver-600">
                  Notificações in-app serão criadas imediatamente; e-mails entram na fila para o dispatcher SMTP.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setConfirmDispatch(null)}>Cancelar</button>
              <button className="btn-gold" onClick={() => dispararMut.mutate(confirmDispatch.id)} disabled={dispararMut.isPending}>
                {dispararMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Disparar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

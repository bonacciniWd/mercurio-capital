import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, Save, X, Loader2, Mail, Bell, MessageSquare, Smartphone } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

type Canal = 'in_app' | 'email' | 'whatsapp' | 'push'

interface Template {
  id: string
  codigo: string
  canal: Canal
  nome: string
  assunto: string | null
  corpo: string
  variaveis: string[]
  ativo: boolean
  wa_template_nome: string | null
  wa_idioma: string | null
  created_at: string
  updated_at: string
  created_by_nome: string | null
}

const CANAL_ICON: Record<Canal, React.ElementType> = {
  in_app: Bell, email: Mail, whatsapp: MessageSquare, push: Smartphone,
}
const CANAL_LBL: Record<Canal, string> = {
  in_app: 'In-app', email: 'E-mail', whatsapp: 'WhatsApp', push: 'Push',
}

function emptyDraft(): Partial<Template> {
  return { codigo: '', canal: 'in_app', nome: '', assunto: '', corpo: '', variaveis: [], ativo: true, wa_idioma: 'pt_BR' }
}

export function AdminTemplates() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Template> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_templates').select('*').order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Template[]
    },
  })
  const templates = templatesQuery.data ?? []

  const upsertMut = useMutation({
    mutationFn: async (t: Partial<Template>) => {
      const { data, error } = await supabase.rpc('admin_template_upsert', {
        p_codigo: t.codigo,
        p_canal: t.canal,
        p_nome: t.nome,
        p_corpo: t.corpo,
        p_id: t.id ?? null,
        p_assunto: t.assunto ?? null,
        p_variaveis: t.variaveis ?? [],
        p_ativo: t.ativo ?? true,
        p_wa_template_nome: t.canal === 'whatsapp' ? (t.wa_template_nome ?? null) : null,
        p_wa_idioma: t.wa_idioma ?? 'pt_BR',
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates'] })
      setEditing(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_template_delete', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
    onError: (e: Error) => setErro(e.message),
  })

  function startNew() { setEditing(emptyDraft()) }
  function startEdit(t: Template) { setEditing({ ...t }) }
  function handleVars(value: string) {
    const arr = value.split(',').map(s => s.trim()).filter(Boolean)
    setEditing(s => s ? { ...s, variaveis: arr } : s)
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Templates de mensagem</h1>
          <p className="text-sm text-silver-500">Reaproveitados por fluxos e campanhas.</p>
        </div>
        <button className="btn-gold" onClick={startNew}>
          <Plus className="h-4 w-4" /> Novo template
        </button>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {erro} <button className="float-right" onClick={() => setErro(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {templatesQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center text-silver-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="p-10 text-center text-silver-500">Nenhum template cadastrado ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Canal</th>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Variáveis</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => {
                const Icon = CANAL_ICON[t.canal]
                return (
                  <tr key={t.id} className="border-t border-silver-100 hover:bg-silver-50">
                    <td className="px-5 py-3"><code className="text-xs text-silver-700">{t.codigo}</code></td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-silver-100 px-2 py-1 text-xs">
                        <Icon className="h-3 w-3" /> {CANAL_LBL[t.canal]}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-silver-900">{t.nome}</td>
                    <td className="px-5 py-3 text-xs text-silver-600">
                      {t.variaveis.length === 0 ? '—' : t.variaveis.map(v => `{{${v}}}`).join(' ')}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={t.ativo ? 'green' : 'gray'}>{t.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="btn-ghost h-7 px-2" onClick={() => startEdit(t)} title="Editar">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn-ghost h-7 px-2 text-red-600"
                        onClick={() => { if (confirm(`Remover ${t.codigo}?`)) deleteMut.mutate(t.id) }}
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-silver-200 px-5 py-3">
              <h2 className="font-semibold text-navy">
                {editing.id ? 'Editar template' : 'Novo template'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-silver-500 hover:text-navy">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código (único)</label>
                  <input className="input" value={editing.codigo ?? ''}
                    onChange={e => setEditing(s => ({ ...s!, codigo: e.target.value }))}
                    placeholder="boas_vindas_partner_v1" />
                </div>
                <div>
                  <label className="label">Canal</label>
                  <select className="input" value={editing.canal}
                    onChange={e => setEditing(s => ({ ...s!, canal: e.target.value as Canal }))}>
                    <option value="in_app">In-app</option>
                    <option value="email">E-mail</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="push">Push (deferido)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Nome</label>
                <input className="input" value={editing.nome ?? ''}
                  onChange={e => setEditing(s => ({ ...s!, nome: e.target.value }))} />
              </div>
              {(editing.canal === 'email' || editing.canal === 'in_app') && (
                <div>
                  <label className="label">Assunto / Título</label>
                  <input className="input" value={editing.assunto ?? ''}
                    onChange={e => setEditing(s => ({ ...s!, assunto: e.target.value }))}
                    placeholder="Use {{variaveis}} aqui também" />
                </div>
              )}
              <div>
                <label className="label">Corpo</label>
                <textarea className="input min-h-[140px] font-mono text-xs" value={editing.corpo ?? ''}
                  onChange={e => setEditing(s => ({ ...s!, corpo: e.target.value }))}
                  placeholder={'Olá {{nome}}, ...'} />
              </div>
              <div>
                <label className="label">Variáveis (separadas por vírgula)</label>
                <input className="input" value={editing.variaveis?.join(', ') ?? ''}
                  onChange={e => handleVars(e.target.value)}
                  placeholder="nome, protocolo, valor" />
              </div>
              {editing.canal === 'whatsapp' && (
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                  <p className="mb-2 text-xs font-semibold text-green-800">WhatsApp Cloud API (Meta)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Template aprovado (nome na Meta)</label>
                      <input className="input" value={editing.wa_template_nome ?? ''}
                        onChange={e => setEditing(s => ({ ...s!, wa_template_nome: e.target.value }))}
                        placeholder="status_proposta" />
                    </div>
                    <div>
                      <label className="label">Idioma</label>
                      <input className="input" value={editing.wa_idioma ?? 'pt_BR'}
                        onChange={e => setEditing(s => ({ ...s!, wa_idioma: e.target.value }))}
                        placeholder="pt_BR" />
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-silver-600">
                    As <b>variáveis</b> acima, na ordem, viram os parâmetros <code className="font-mono">{'{{1}}, {{2}}…'}</code> do template aprovado.
                    Deixe o nome em branco para enviar texto livre (válido só na janela de 24h).
                  </p>
                </div>
              )}
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-gold" checked={editing.ativo ?? true}
                  onChange={e => setEditing(s => ({ ...s!, ativo: e.target.checked }))} />
                Ativo
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-silver-200 px-5 py-3">
              <button className="btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-gold" onClick={() => editing && upsertMut.mutate(editing)} disabled={upsertMut.isPending}>
                {upsertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

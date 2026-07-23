import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Save, Trash2, Loader2, AlertCircle, Edit2, Flag } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FeatureFlag {
  id: string
  chave: string
  descricao: string | null
  regras: { roles?: string[]; partner_ids?: string[]; percent?: number }
  ativo: boolean
}

const ROLES = ['admin', 'partner', 'team_member', 'client'] as const

function emptyDraft(): Partial<FeatureFlag> {
  return { chave: '', descricao: '', regras: { roles: [], percent: 100 }, ativo: false }
}

export function AdminFeatureFlags() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<FeatureFlag> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const flagsQuery = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_feature_flags').select('*')
      if (error) throw error
      return (data ?? []) as FeatureFlag[]
    },
  })
  const flags = flagsQuery.data ?? []

  const upsertMut = useMutation({
    mutationFn: async (f: Partial<FeatureFlag>) => {
      const { data, error } = await supabase.rpc('admin_feature_flag_upsert', {
        p_chave: f.chave,
        p_descricao: f.descricao ?? null,
        p_regras: f.regras ?? {},
        p_ativo: f.ativo ?? false,
        p_id: f.id ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-feature-flags'] }); setEditing(null) },
    onError: (e: Error) => setErro(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_feature_flag_delete', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feature-flags'] }),
    onError: (e: Error) => setErro(e.message),
  })

  const toggleAtivoMut = useMutation({
    mutationFn: async (f: FeatureFlag) => {
      const { error } = await supabase.rpc('admin_feature_flag_upsert', {
        p_chave: f.chave,
        p_descricao: f.descricao,
        p_regras: f.regras,
        p_ativo: !f.ativo,
        p_id: f.id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feature-flags'] }),
    onError: (e: Error) => setErro(e.message),
  })

  function toggleRole(r: string) {
    setEditing(s => {
      if (!s) return s
      const roles = s.regras?.roles ?? []
      const next = roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r]
      return { ...s, regras: { ...(s.regras ?? {}), roles: next } }
    })
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Feature Flags</h1>
          <p className="text-sm text-silver-500">Liga/desliga features e segmenta por role, parceiro ou rollout %.</p>
        </div>
        <button className="btn-gold" onClick={() => setEditing(emptyDraft())}>
          <Plus className="h-4 w-4" /> Nova flag
        </button>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {flagsQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-silver-500" /></div>
        ) : flags.length === 0 ? (
          <div className="p-10 text-center text-silver-500"><Flag className="mx-auto h-8 w-8 mb-2" /> Nenhuma feature flag.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                <th className="px-5 py-3">Chave</th>
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3">Regras</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {flags.map(f => (
                <tr key={f.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-5 py-3 font-mono text-xs text-silver-900">{f.chave}</td>
                  <td className="px-5 py-3 text-silver-600">{f.descricao ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-silver-600">
                    {f.regras?.roles?.length ? <>roles: <b>{f.regras.roles.join(', ')}</b><br /></> : null}
                    {typeof f.regras?.percent === 'number' && f.regras.percent < 100 ? <>rollout: <b>{f.regras.percent}%</b></> : null}
                    {!f.regras?.roles?.length && (f.regras?.percent === undefined || f.regras.percent === 100) ? 'global' : null}
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleAtivoMut.mutate(f)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${f.ativo ? 'bg-success/15 text-success' : 'bg-silver-100 text-silver-500'}`}>
                      <span className={`h-2 w-2 rounded-full ${f.ativo ? 'bg-success' : 'bg-silver-400'}`} />
                      {f.ativo ? 'on' : 'off'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button className="btn-ghost h-7 px-2" onClick={() => setEditing({ ...f })}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button className="btn-ghost h-7 px-2 text-red-600"
                      onClick={() => { if (confirm(`Remover "${f.chave}"?`)) deleteMut.mutate(f.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-silver-200 px-5 py-3">
              <h2 className="font-semibold text-navy">{editing.id ? 'Editar flag' : 'Nova flag'}</h2>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-silver-500" /></button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="label">Chave</label>
                <input className="input font-mono" value={editing.chave ?? ''}
                  onChange={e => setEditing(s => ({ ...s!, chave: e.target.value }))}
                  placeholder="ex: universidade_paga" />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input className="input" value={editing.descricao ?? ''}
                  onChange={e => setEditing(s => ({ ...s!, descricao: e.target.value }))} />
              </div>
              <div>
                <label className="label">Roles permitidas</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(r => {
                    const on = (editing.regras?.roles ?? []).includes(r)
                    return (
                      <button key={r} type="button" onClick={() => toggleRole(r)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-gold bg-gold/10 text-red-700' : 'border-silver-300 text-silver-600'}`}>
                        {r}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-silver-500">Vazio = todas roles.</p>
              </div>
              <div>
                <label className="label">Rollout (%)</label>
                <input type="number" min={0} max={100} className="input w-32"
                  value={editing.regras?.percent ?? 100}
                  onChange={e => setEditing(s => ({ ...s!, regras: { ...(s!.regras ?? {}), percent: Number(e.target.value) } }))} />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-gold" checked={editing.ativo ?? false}
                  onChange={e => setEditing(s => ({ ...s!, ativo: e.target.checked }))} />
                Ativo
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-silver-200 px-5 py-3">
              <button className="btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-gold" onClick={() => upsertMut.mutate(editing)}
                disabled={upsertMut.isPending || !editing.chave}>
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

export { AdminFeatureFlags as default }

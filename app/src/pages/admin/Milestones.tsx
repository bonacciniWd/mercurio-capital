import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Loader2, X, Upload, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { Badge } from '@/components/Badge'

interface Milestone {
  id: string
  order_index: number
  label: string
  prize: string
  descricao: string | null
  target_centavos: number
  color: string
  image_url: string | null
  image_storage_path: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

type Draft = Omit<Milestone, 'id' | 'created_at' | 'updated_at'> & { id?: string }

const EMPTY_DRAFT: Draft = {
  order_index: 1,
  label: '',
  prize: '',
  descricao: '',
  target_centavos: 0,
  color: '#D4AF37',
  image_url: null,
  image_storage_path: null,
  ativo: true,
}

function imageUrl(m: { image_url: string | null; image_storage_path: string | null }): string | null {
  if (m.image_storage_path) {
    const { data } = supabase.storage.from('milestone-images').getPublicUrl(m.image_storage_path)
    return data.publicUrl
  }
  return m.image_url
}

export function AdminMilestones() {
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-milestones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_milestones')
        .select('*')
        .order('order_index')
      if (error) throw error
      return (data ?? []) as Milestone[]
    },
  })

  const items = listQuery.data ?? []

  const salvar = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        order_index: d.order_index,
        label: d.label.trim(),
        prize: d.prize.trim(),
        descricao: (d.descricao ?? '').trim() || null,
        target_centavos: d.target_centavos,
        color: d.color,
        image_url: d.image_url,
        image_storage_path: d.image_storage_path,
        ativo: d.ativo,
      }
      if (!payload.label) throw new Error('Informe o rotulo (label) do milestone.')
      if (!payload.prize) throw new Error('Informe o nome do premio.')
      if (!payload.target_centavos || payload.target_centavos <= 0)
        throw new Error('Meta em centavos deve ser maior que zero.')

      if (d.id) {
        const { error } = await supabase.from('partner_milestones').update(payload).eq('id', d.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('partner_milestones').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setEditing(null)
      setErro(null)
      void qc.invalidateQueries({ queryKey: ['admin-milestones'] })
      void qc.invalidateQueries({ queryKey: ['partner-milestones-list'] })
    },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('partner_milestones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-milestones'] })
      void qc.invalidateQueries({ queryKey: ['partner-milestones-list'] })
    },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const toggleAtivo = useMutation({
    mutationFn: async (m: Milestone) => {
      const { error } = await supabase
        .from('partner_milestones')
        .update({ ativo: !m.ativo })
        .eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-milestones'] })
      void qc.invalidateQueries({ queryKey: ['partner-milestones-list'] })
    },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const uploadImagem = useMutation({
    mutationFn: async ({ file, draft }: { file: File; draft: Draft }) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const key = draft.id ?? `novo-${crypto.randomUUID()}`
      const path = `${key}/imagem-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('milestone-images').upload(path, file, {
        upsert: true,
        contentType: file.type,
      })
      if (error) throw error
      return path
    },
    onSuccess: (path) => {
      setEditing((prev) => (prev ? { ...prev, image_storage_path: path, image_url: null } : prev))
    },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Milestones</h1>
          <p className="text-sm text-silver-600">
            Cadastre os premios exibidos aos parceiros conforme volume liberado de CGI.
          </p>
        </div>
        <button className="btn-gold" onClick={() => setEditing({ ...EMPTY_DRAFT, order_index: (items[items.length - 1]?.order_index ?? 0) + 1 })}>
          <Plus className="h-4 w-4" /> Novo milestone
        </button>
      </div>

      {erro && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {erro}
          </span>
          <button onClick={() => setErro(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="card overflow-hidden">
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-silver-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-silver-500">
            Nenhum milestone cadastrado. Clique em <strong>Novo milestone</strong> para comecar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                <th className="px-4 py-3">Ordem</th>
                <th className="px-4 py-3">Imagem</th>
                <th className="px-4 py-3">Rotulo / Premio</th>
                <th className="px-4 py-3">Meta</th>
                <th className="px-4 py-3">Cor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const url = imageUrl(m)
                return (
                  <tr key={m.id} className="border-t border-silver-100 hover:bg-silver-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-silver-500">#{m.order_index}</td>
                    <td className="px-4 py-3">
                      {url ? (
                        <img src={url} alt={m.prize} className="h-10 w-16 rounded object-contain" />
                      ) : (
                        <span className="text-xs text-silver-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy">{m.prize}</p>
                      <p className="text-xs text-silver-500">{m.label}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">{brl(Number(m.target_centavos))}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-xs text-silver-600">
                        <span className="h-4 w-4 rounded border border-silver-300" style={{ background: m.color }} />
                        {m.color}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.ativo
                        ? <Badge variant="green">Ativo</Badge>
                        : <Badge variant="gray">Inativo</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-md p-1.5 hover:bg-silver-100"
                          title={m.ativo ? 'Desativar' : 'Ativar'}
                          onClick={() => toggleAtivo.mutate(m)}
                        >
                          {m.ativo
                            ? <EyeOff className="h-4 w-4 text-silver-500" />
                            : <Eye className="h-4 w-4 text-green-600" />}
                        </button>
                        <button
                          className="rounded-md p-1.5 hover:bg-silver-100"
                          title="Editar"
                          onClick={() => setEditing({
                            id: m.id,
                            order_index: m.order_index,
                            label: m.label,
                            prize: m.prize,
                            descricao: m.descricao,
                            target_centavos: Number(m.target_centavos),
                            color: m.color,
                            image_url: m.image_url,
                            image_storage_path: m.image_storage_path,
                            ativo: m.ativo,
                          })}
                        >
                          <Edit2 className="h-4 w-4 text-silver-600" />
                        </button>
                        <button
                          className="rounded-md p-1.5 hover:bg-red-50"
                          title="Excluir"
                          onClick={() => {
                            if (confirm(`Remover milestone "${m.prize}"?`)) excluir.mutate(m.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditModal
          draft={editing}
          onChange={setEditing}
          onClose={() => { setEditing(null); setErro(null) }}
          onSave={() => salvar.mutate(editing)}
          onUpload={(file) => uploadImagem.mutate({ file, draft: editing })}
          saving={salvar.isPending}
          uploading={uploadImagem.isPending}
        />
      )}
    </>
  )
}

function EditModal({
  draft, onChange, onClose, onSave, onUpload, saving, uploading,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  onClose: () => void
  onSave: () => void
  onUpload: (file: File) => void
  saving: boolean
  uploading: boolean
}) {
  const [targetReais, setTargetReais] = useState(() => (Number(draft.target_centavos) / 100).toString())

  // Se o draft mudar externamente (ex: upload finalizou), garante sincronizacao
  useEffect(() => {
    setTargetReais((Number(draft.target_centavos) / 100).toString())
  }, [draft.target_centavos])

  const url = imageUrl(draft)

  function updateTarget(v: string) {
    setTargetReais(v)
    const num = Number(v.replace(',', '.'))
    if (!Number.isNaN(num) && num > 0) {
      onChange({ ...draft, target_centavos: Math.round(num * 100) })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-navy">
            {draft.id ? 'Editar milestone' : 'Novo milestone'}
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-silver-500" /></button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Ordem</label>
            <input
              type="number" min={1} className="input"
              value={draft.order_index}
              onChange={(e) => onChange({ ...draft, order_index: Number(e.target.value) || 1 })}
            />
          </div>
          <div>
            <label className="label">Meta (R$)</label>
            <input
              type="number" step="0.01" min={0} className="input"
              placeholder="Ex: 5000000.00"
              value={targetReais}
              onChange={(e) => updateTarget(e.target.value)}
            />
            <p className="mt-1 text-xs text-silver-500">
              Armazenado como {brl(draft.target_centavos)} ({draft.target_centavos} centavos)
            </p>
          </div>

          <div>
            <label className="label">Rotulo</label>
            <input
              className="input" placeholder='Ex: "R$ 5 Milhoes"'
              value={draft.label}
              onChange={(e) => onChange({ ...draft, label: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nome do premio</label>
            <input
              className="input" placeholder='Ex: "Rolex Oyster Perpetual"'
              value={draft.prize}
              onChange={(e) => onChange({ ...draft, prize: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Descricao</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Copy exibida no card do parceiro"
              value={draft.descricao ?? ''}
              onChange={(e) => onChange({ ...draft, descricao: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Cor (hex)</label>
            <div className="flex items-center gap-2">
              <input
                type="color" className="h-9 w-12 cursor-pointer rounded border border-silver-300"
                value={draft.color}
                onChange={(e) => onChange({ ...draft, color: e.target.value })}
              />
              <input
                className="input flex-1" placeholder="#D4AF37"
                value={draft.color}
                onChange={(e) => onChange({ ...draft, color: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.ativo}
                onChange={(e) => onChange({ ...draft, ativo: e.target.checked })}
              />
              Ativo (exibir aos parceiros)
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="label">Imagem do premio</label>
            <div className="flex items-start gap-4">
              <div className="flex h-32 w-40 items-center justify-center rounded-lg border border-silver-200 bg-silver-50">
                {url ? (
                  <img src={url} alt="preview" className="max-h-28 max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-silver-400">sem imagem</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="btn-outline inline-flex cursor-pointer items-center gap-2 text-sm">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Enviando...' : 'Enviar imagem'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onUpload(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                <p className="text-xs text-silver-500">
                  PNG, JPG, WEBP ou SVG. Recomendado 600x500 com fundo transparente.
                </p>
                <div>
                  <label className="label">Ou informe uma URL externa</label>
                  <input
                    className="input"
                    placeholder="https://... ou /milestones/prem1.svg"
                    value={draft.image_url ?? ''}
                    onChange={(e) => onChange({
                      ...draft,
                      image_url: e.target.value || null,
                      // se preencher URL manualmente, priorizamos ela sobre o storage
                      image_storage_path: e.target.value ? null : draft.image_storage_path,
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-gold" onClick={onSave} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}


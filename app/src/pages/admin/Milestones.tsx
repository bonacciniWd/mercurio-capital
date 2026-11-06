import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Loader2, X, Upload, Eye, EyeOff, AlertTriangle, Image as ImageIcon, RefreshCw } from 'lucide-react'
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy">Milestones</h1>
          <p className="mt-1 max-w-2xl text-sm text-silver-600">
            Configure as metas, prêmios e imagens exibidos no programa do parceiro.
          </p>
          {!listQuery.isLoading && !listQuery.isError && (
            <p className="mt-2 text-xs font-medium text-silver-500">
              {items.length} {items.length === 1 ? 'milestone cadastrado' : 'milestones cadastrados'} · {items.filter((item) => item.ativo).length} ativos
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-gold w-full shrink-0 sm:w-auto"
          disabled={listQuery.isLoading || listQuery.isError}
          onClick={() => setEditing({ ...EMPTY_DRAFT, order_index: (items[items.length - 1]?.order_index ?? 0) + 1 })}
        >
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

      {listQuery.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="h-5 w-5 text-red-700" />
          <div>
            <p className="text-sm font-semibold text-red-800">Não foi possível carregar os milestones.</p>
            <p className="mt-1 text-xs text-red-700">Tente novamente. Seus dados não foram alterados.</p>
          </div>
          <button type="button" className="btn-no-liquid btn-outline" onClick={() => void listQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      ) : listQuery.isLoading ? (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-silver-200 bg-white py-16 text-sm text-silver-500">
          <Loader2 className="h-5 w-5 animate-spin text-gold" /> Carregando milestones…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-silver-300 bg-white px-5 py-14 text-center">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-gold/15 text-gold-700"><Plus className="h-5 w-5" /></div>
          <h2 className="text-base font-semibold text-navy">Nenhum milestone cadastrado</h2>
          <p className="mt-1 max-w-md text-sm text-silver-600">Crie a primeira meta e configure o prêmio que será exibido aos parceiros.</p>
          <button type="button" className="btn-gold mt-4" onClick={() => setEditing({ ...EMPTY_DRAFT, order_index: 1 })}>
            <Plus className="h-4 w-4" /> Criar primeiro milestone
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-silver-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-silver-50 text-left text-xs font-semibold uppercase text-silver-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Ordem</th>
                  <th scope="col" className="px-4 py-3">Prêmio</th>
                  <th scope="col" className="px-4 py-3">Meta</th>
                  <th scope="col" className="px-4 py-3">Cor</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silver-100">
                {items.map((m) => <MilestoneRow
                  key={m.id}
                  milestone={m}
                  onToggle={() => toggleAtivo.mutate(m)}
                  onEdit={() => setEditing(toDraft(m))}
                  onDelete={() => { if (confirm(`Remover milestone "${m.prize}"?`)) excluir.mutate(m.id) }}
                  disabled={toggleAtivo.isPending || excluir.isPending}
                />)}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-silver-100 md:hidden">
            {items.map((m) => <MilestoneMobileItem
              key={m.id}
              milestone={m}
              onToggle={() => toggleAtivo.mutate(m)}
              onEdit={() => setEditing(toDraft(m))}
              onDelete={() => { if (confirm(`Remover milestone "${m.prize}"?`)) excluir.mutate(m.id) }}
              disabled={toggleAtivo.isPending || excluir.isPending}
            />)}
          </div>
        </div>
      )}

      {editing && (
        <EditModal
          draft={editing}
          onChange={setEditing}
          onClose={() => { setEditing(null); setErro(null) }}
          onSave={() => salvar.mutate(editing)}
          onUpload={(file) => uploadImagem.mutate({ file, draft: editing })}
          saving={salvar.isPending}
          uploading={uploadImagem.isPending}
          error={erro}
        />
      )}
    </>
  )
}

function toDraft(m: Milestone): Draft {
  return {
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
  }
}

function MilestoneActions({
  milestone,
  onToggle,
  onEdit,
  onDelete,
  disabled,
}: {
  milestone: Milestone
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn-no-liquid h-9 w-9 rounded-full p-0 text-silver-600 hover:bg-silver-100" title={milestone.ativo ? 'Desativar milestone' : 'Ativar milestone'} aria-label={milestone.ativo ? `Desativar ${milestone.prize}` : `Ativar ${milestone.prize}`} disabled={disabled} onClick={onToggle}>
        {milestone.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-green-700" />}
      </button>
      <button type="button" className="btn-no-liquid h-9 w-9 rounded-full p-0 text-silver-600 hover:bg-silver-100" title="Editar milestone" aria-label={`Editar ${milestone.prize}`} onClick={onEdit}>
        <Edit2 className="h-4 w-4" />
      </button>
      <button type="button" className="btn-no-liquid h-9 w-9 rounded-full p-0 text-red-700 hover:bg-red-50" title="Excluir milestone" aria-label={`Excluir ${milestone.prize}`} disabled={disabled} onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function MilestoneImage({ milestone }: { milestone: Milestone }) {
  const url = imageUrl(milestone)
  return (
    <div className="grid h-14 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-silver-200 bg-silver-50">
      {url ? <img src={url} alt="" className="h-full w-full object-contain p-1" /> : <ImageIcon className="h-5 w-5 text-silver-400" />}
    </div>
  )
}

function MilestoneRow({ milestone, onToggle, onEdit, onDelete, disabled }: {
  milestone: Milestone
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  disabled: boolean
}) {
  return (
    <tr className="transition-colors hover:bg-silver-50/70">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-silver-500">#{milestone.order_index}</td>
      <td className="px-4 py-3">
        <div className="flex min-w-64 items-center gap-3">
          <MilestoneImage milestone={milestone} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy">{milestone.prize}</p>
            <p className="mt-0.5 truncate text-xs text-silver-500">{milestone.label}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-navy">{brl(Number(milestone.target_centavos))}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 text-xs text-silver-600">
          <span className="h-5 w-5 rounded border border-silver-300" style={{ background: milestone.color }} />
          <span className="font-mono">{milestone.color}</span>
        </span>
      </td>
      <td className="px-4 py-3">{milestone.ativo ? <Badge variant="green">Ativo</Badge> : <Badge variant="gray">Inativo</Badge>}</td>
      <td className="px-4 py-3"><div className="flex justify-end"><MilestoneActions milestone={milestone} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} disabled={disabled} /></div></td>
    </tr>
  )
}

function MilestoneMobileItem({ milestone, onToggle, onEdit, onDelete, disabled }: {
  milestone: Milestone
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  disabled: boolean
}) {
  return (
    <article className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <MilestoneImage milestone={milestone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-navy">{milestone.prize}</h2>
            {milestone.ativo ? <Badge variant="green">Ativo</Badge> : <Badge variant="gray">Inativo</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-silver-500">#{milestone.order_index} · {milestone.label}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase text-silver-500">Meta</p>
          <p className="font-semibold tabular-nums text-navy">{brl(Number(milestone.target_centavos))}</p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-silver-500"><span className="h-3 w-3 rounded border border-silver-300" style={{ background: milestone.color }} />{milestone.color}</span>
        </div>
        <MilestoneActions milestone={milestone} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
      </div>
    </article>
  )
}

function EditModal({
  draft, onChange, onClose, onSave, onUpload, saving, uploading, error,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  onClose: () => void
  onSave: () => void
  onUpload: (file: File) => void
  saving: boolean
  uploading: boolean
  error: string | null
}) {
  const titleId = useId()
  const modalRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const isBusyRef = useRef(false)
  isBusyRef.current = saving || uploading

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const [targetReais, setTargetReais] = useState(() => (Number(draft.target_centavos) / 100).toString())

  // Se o draft mudar externamente (ex: upload finalizou), garante sincronizacao
  useEffect(() => {
    setTargetReais((Number(draft.target_centavos) / 100).toString())
  }, [draft.target_centavos])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modal = modalRef.current
    const firstField = modal?.querySelector<HTMLElement>('input, textarea, button')
    firstField?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isBusyRef.current) onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !modal) return
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  const url = imageUrl(draft)

  function updateTarget(v: string) {
    setTargetReais(v)
    const num = Number(v.replace(',', '.'))
    if (!Number.isNaN(num) && num > 0) {
      onChange({ ...draft, target_centavos: Math.round(num * 100) })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving && !uploading) onClose() }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between border-b border-silver-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-navy">{draft.id ? 'Editar milestone' : 'Novo milestone'}</h2>
            <p className="mt-0.5 text-xs text-silver-500">Configure como a meta e o prêmio aparecem para parceiros.</p>
          </div>
          <button type="button" className="btn-no-liquid grid h-10 w-10 place-items-center rounded-full p-0 text-silver-600 hover:bg-silver-100" onClick={onClose} disabled={saving || uploading} aria-label="Fechar edição">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          <section aria-labelledby={`${titleId}-goal`}>
            <h3 id={`${titleId}-goal`} className="text-xs font-semibold uppercase text-silver-500">Meta</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-navy">
                Ordem
                <input type="number" min={1} className="input" value={draft.order_index} onChange={(e) => onChange({ ...draft, order_index: Number(e.target.value) || 1 })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-navy">
                Meta (R$)
                <input type="number" step="0.01" min={0} className="input" placeholder="Ex.: 5000000,00" value={targetReais} onChange={(e) => updateTarget(e.target.value)} />
              </label>
              <p className="-mt-3 text-xs text-silver-500">Armazenado como {brl(draft.target_centavos)} ({draft.target_centavos} centavos)</p>
              <label className="grid gap-1.5 text-sm font-medium text-navy">
                Rótulo da meta
                <input className="input" placeholder="Ex.: R$ 5 Milhões" value={draft.label} onChange={(e) => onChange({ ...draft, label: e.target.value })} />
              </label>
            </div>
          </section>

          <section aria-labelledby={`${titleId}-prize`}>
            <h3 id={`${titleId}-prize`} className="text-xs font-semibold uppercase text-silver-500">Prêmio</h3>
            <div className="mt-3 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-navy">
                Nome do prêmio
                <input className="input" placeholder="Ex.: Rolex Oyster Perpetual" value={draft.prize} onChange={(e) => onChange({ ...draft, prize: e.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-navy">
                Descrição
                <textarea className="input min-h-24 py-2" placeholder="Texto exibido no card do parceiro" value={draft.descricao ?? ''} onChange={(e) => onChange({ ...draft, descricao: e.target.value })} />
              </label>
            </div>
          </section>

          <section aria-labelledby={`${titleId}-presentation`}>
            <h3 id={`${titleId}-presentation`} className="text-xs font-semibold uppercase text-silver-500">Apresentação</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-navy">
                Cor do milestone
                <span className="flex items-center gap-2">
                  <input type="color" className="h-10 w-12 cursor-pointer rounded border border-silver-300" value={draft.color} onChange={(e) => onChange({ ...draft, color: e.target.value })} aria-label="Selecionar cor do milestone" />
                  <input className="input flex-1 font-mono" placeholder="#D4AF37" value={draft.color} onChange={(e) => onChange({ ...draft, color: e.target.value })} aria-label="Código hexadecimal da cor" />
                </span>
              </label>
              <label className="flex min-h-10 items-center gap-3 rounded-md border border-silver-200 px-3 py-2 text-sm text-navy">
                <input type="checkbox" checked={draft.ativo} onChange={(e) => onChange({ ...draft, ativo: e.target.checked })} />
                Exibir aos parceiros
              </label>
              <div className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-navy">Imagem do prêmio</span>
                <div className="flex flex-col gap-3 rounded-md border border-silver-200 bg-silver-50 p-3 sm:flex-row sm:items-center">
                  <div className="grid h-28 w-full shrink-0 place-items-center overflow-hidden rounded-md border border-silver-200 bg-white sm:w-40">
                    {url ? <img src={url} alt={`Prévia da imagem: ${draft.prize || 'prêmio'}`} className="max-h-full max-w-full object-contain p-2" /> : <span className="text-xs text-silver-400">Sem imagem</span>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <label className="btn-outline inline-flex cursor-pointer items-center gap-2 text-sm focus-within:ring-2 focus-within:ring-gold focus-within:ring-offset-2">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? 'Enviando imagem…' : 'Enviar imagem'}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={uploading} aria-label="Selecionar imagem do prêmio" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = '' }} />
                      </label>
                      <p className="mt-1 text-xs text-silver-500">PNG, JPG, WEBP ou SVG. Recomendado: 600 × 500 px com fundo transparente.</p>
                    </div>
                    <label className="grid gap-1 text-xs font-medium text-silver-600">
                      Ou informe uma URL externa
                      <input className="input" placeholder="https://… ou /milestones/premio.svg" value={draft.image_url ?? ''} onChange={(e) => onChange({ ...draft, image_url: e.target.value || null, image_storage_path: e.target.value ? null : draft.image_storage_path })} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-silver-200 bg-white px-5 py-4 sm:px-6">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving || uploading}>Cancelar</button>
          <button type="button" className="btn-gold min-w-28" onClick={onSave} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  )
}


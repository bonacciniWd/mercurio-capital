import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, Camera, Loader2, Plus, UserPlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type CatalogItem = { id: string; nome: string; ativo: boolean }
type Employee = {
  usuario_id: string; nome_completo: string; email: string; ativo: boolean; ultimo_login_at: string | null
  admin_nivel: string; cargo_id: string | null; cargo: string | null; departamento_id: string | null
  departamento: string | null; gestor_usuario_id: string | null; gestor_nome: string | null
  foto_path: string | null; data_inicio: string | null
}
type Catalogs = { cargos: CatalogItem[]; departamentos: CatalogItem[] }

const emptyCatalogs: Catalogs = { cargos: [], departamentos: [] }

export function EquipeInterna() {
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [catalogs, setCatalogs] = useState<Catalogs>(emptyCatalogs)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [editor, setEditor] = useState<Employee | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [catalogName, setCatalogName] = useState('')
  const [catalogType, setCatalogType] = useState<'cargo' | 'departamento'>('cargo')
  const [busy, setBusy] = useState(false)

  async function load() {
    setError('')
    const [usersRes, catalogRes] = await Promise.all([
      supabase.rpc('admin_internal_team_list'),
      supabase.rpc('admin_internal_team_catalogs'),
    ])
    if (usersRes.error) { setError(usersRes.error.message); setEmployees(null) }
    else setEmployees((usersRes.data ?? []) as Employee[])
    if (catalogRes.error) setError(catalogRes.error.message)
    else setCatalogs((catalogRes.data ?? emptyCatalogs) as Catalogs)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function saveProfile(form: FormData) {
    if (!editor) return
    setBusy(true); setError(''); setFeedback('')
    let fotoPath = editor.foto_path
    const file = form.get('foto') as File | null
    if (file?.size) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        setError('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.'); setBusy(false); return
      }
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
      fotoPath = `${editor.usuario_id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatares-internos').upload(fotoPath, file, { contentType: file.type, upsert: false })
      if (uploadError) { setError(uploadError.message); setBusy(false); return }
    }
    const { error: saveError } = await supabase.rpc('admin_internal_team_update', {
      p_usuario_id: editor.usuario_id,
      p_cargo_id: String(form.get('cargo') || '') || null,
      p_departamento_id: String(form.get('departamento') || '') || null,
      p_gestor_usuario_id: String(form.get('gestor') || '') || null,
      p_foto_path: fotoPath,
      p_data_inicio: String(form.get('data_inicio') || '') || null,
    })
    setBusy(false)
    if (saveError) {
      if (fotoPath && fotoPath !== editor.foto_path) await supabase.storage.from('avatares-internos').remove([fotoPath])
      setError(saveError.message); return
    }
    if (editor.foto_path && fotoPath !== editor.foto_path) await supabase.storage.from('avatares-internos').remove([editor.foto_path])
    setEditor(null); setFeedback('Dados do colaborador salvos.'); await load()
  }

  async function invite(form: FormData) {
    setBusy(true); setError(''); setFeedback('')
    const { data, error: inviteError } = await supabase.functions.invoke('admin-invite-internal', {
      body: { nome_completo: String(form.get('nome') || ''), email: String(form.get('email') || '') },
    })
    setBusy(false)
    if (inviteError || data?.error) { setError(data?.error || inviteError?.message || 'Não foi possível criar o convite.'); return }
    setInviteOpen(false); setFeedback('Convite enviado. O novo usuário receberá acesso administrativo limitado.'); await load()
  }

  async function saveCatalog(form?: FormData, item?: CatalogItem, active?: boolean) {
    const name = item?.nome ?? String(form?.get('nome') || '').trim()
    if (!name) return
    setBusy(true); setError('')
    const { error: catalogError } = await supabase.rpc('admin_internal_team_catalog_upsert', {
      p_tipo: catalogType, p_id: item?.id ?? null, p_nome: name, p_descricao: null, p_ativo: active ?? item?.ativo ?? true,
    })
    setBusy(false)
    if (catalogError) { setError(catalogError.message); return }
    setCatalogName(''); await load()
  }

  const activeEmployees = useMemo(() => (employees ?? []).filter(employee => employee.ativo), [employees])

  return <section className="mb-8 rounded-xl border border-silver-200 bg-white p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold text-navy">Equipe interna</h3><p className="mt-1 text-xs text-silver-500">Cadastros organizacionais e convites de acesso. Cargo não altera o nível de permissão.</p></div>
      <button className="btn-gold" onClick={() => { setError(''); setInviteOpen(true) }}><UserPlus className="h-4 w-4" /> Convidar colaborador</button>
    </div>
    {error && <p role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
    {feedback && <p className="mb-3 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{feedback}</p>}
    {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-silver-500" /></div> : employees === null ? <p className="py-5 text-sm text-silver-500">Não foi possível carregar os usuários internos.</p> : employees.length === 0 ? <p className="py-5 text-sm text-silver-500">Nenhum usuário interno encontrado.</p> : <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-silver-50 text-left text-[11px] uppercase tracking-wide text-silver-500"><tr><th className="px-3 py-2.5">Colaborador</th><th className="px-3 py-2.5">Cargo</th><th className="px-3 py-2.5">Departamento</th><th className="px-3 py-2.5">Gestor</th><th className="px-3 py-2.5">Acesso</th><th className="px-3 py-2.5" /></tr></thead>
        <tbody>{employees.map(employee => <tr key={employee.usuario_id} className="border-t border-silver-100">
          <td className="px-3 py-3"><div className="font-medium text-silver-900">{employee.nome_completo}</div><div className="text-xs text-silver-500">{employee.email}</div></td>
          <td className="px-3 py-3 text-silver-700">{employee.cargo || '—'}</td><td className="px-3 py-3 text-silver-700">{employee.departamento || '—'}</td><td className="px-3 py-3 text-silver-700">{employee.gestor_nome || '—'}</td>
          <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${employee.ativo ? 'bg-success/10 text-success' : 'bg-silver-100 text-silver-600'}`}>{employee.ativo ? `Ativo · ${employee.admin_nivel}` : 'Inativo'}</span></td>
          <td className="px-3 py-3 text-right"><button className="btn-outline h-8 px-3 text-xs" onClick={() => { setError(''); setEditor(employee) }}>Editar perfil</button></td>
        </tr>)}</tbody>
      </table>
    </div>}

    <div className="mt-6 border-t border-silver-100 pt-5">
      <div className="mb-3 flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-navy" /><h4 className="text-sm font-semibold text-navy">Cargos e departamentos</h4></div>
      <div className="grid gap-4 md:grid-cols-2">
        {(['cargo','departamento'] as const).map(type => {
          const list = type === 'cargo' ? catalogs.cargos : catalogs.departamentos
          return <div key={type} className="rounded-lg border border-silver-200 p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-silver-800">{type === 'cargo' ? 'Cargos' : 'Departamentos'}</span><button type="button" className="text-xs text-red-700 hover:underline" onClick={() => { setCatalogType(type); setCatalogName('') }}>Adicionar</button></div>
            <div className="flex flex-wrap gap-2">{list.map(item => <button key={item.id} title="Clique para ativar/desativar" onClick={() => { setCatalogType(type); void saveCatalog(undefined, item, !item.ativo) }} className={`rounded-full border px-2.5 py-1 text-xs ${item.ativo ? 'border-silver-200 text-silver-700' : 'border-silver-100 text-silver-400 line-through'}`}>{item.nome}</button>)}{!list.length && <span className="text-xs text-silver-400">Nenhum cadastrado.</span>}</div>
            {catalogType === type && <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; void saveCatalog(new FormData(form)); form.reset() }}><input name="nome" className="input h-9 flex-1" minLength={2} maxLength={100} placeholder={`Novo ${type === 'cargo' ? 'cargo' : 'departamento'}`} required value={catalogName} onChange={event => setCatalogName(event.target.value)} /><button className="btn-gold h-9 px-3" disabled={busy}><Plus className="h-4 w-4" /></button></form>}
          </div>
        })}
      </div>
    </div>

    {inviteOpen && <Modal title="Convidar usuário interno" onClose={() => setInviteOpen(false)}><form onSubmit={event => { event.preventDefault(); void invite(new FormData(event.currentTarget)) }} className="space-y-4">
      <p className="text-sm text-silver-600">Será criada uma conta interna com nível administrativo limitado. A promoção para acesso completo continua sujeita ao processo administrativo.</p>
      <label className="label">Nome completo<input name="nome" className="input mt-1" minLength={3} maxLength={120} required autoFocus /></label>
      <label className="label">E-mail corporativo<input name="email" className="input mt-1" type="email" required /></label>
      <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setInviteOpen(false)}>Cancelar</button><button className="btn-gold" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Enviar convite</button></div>
    </form></Modal>}
    {editor && <Modal title={`Perfil · ${editor.nome_completo}`} onClose={() => setEditor(null)}><form onSubmit={event => { event.preventDefault(); void saveProfile(new FormData(event.currentTarget)) }} className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-silver-50 p-3"><Camera className="h-5 w-5 text-silver-500" /><div><p className="text-sm font-medium text-silver-800">Foto do colaborador</p><p className="text-xs text-silver-500">JPG, PNG ou WebP · até 5 MB · armazenada em área privada</p></div></div>
      <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
      <label className="label">Cargo<select name="cargo" className="input mt-1" defaultValue={editor.cargo_id || ''}><option value="">Sem cargo</option>{catalogs.cargos.filter(x => x.ativo).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      <label className="label">Departamento<select name="departamento" className="input mt-1" defaultValue={editor.departamento_id || ''}><option value="">Sem departamento</option>{catalogs.departamentos.filter(x => x.ativo).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      <label className="label">Gestor direto<select name="gestor" className="input mt-1" defaultValue={editor.gestor_usuario_id || ''}><option value="">Sem gestor</option>{activeEmployees.filter(x => x.usuario_id !== editor.usuario_id).map(item => <option key={item.usuario_id} value={item.usuario_id}>{item.nome_completo}</option>)}</select></label>
      <label className="label">Data de início<input name="data_inicio" type="date" className="input mt-1" defaultValue={editor.data_inicio || ''} /></label>
      <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setEditor(null)}>Cancelar</button><button className="btn-gold" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar perfil</button></div>
    </form></Modal>}
  </section>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-navy">{title}</h3><button aria-label="Fechar" className="btn-no-liquid rounded p-1 text-silver-500 hover:bg-silver-100" onClick={onClose}><X className="h-5 w-5" /></button></div>{children}</section>
  </div>
}

export { OrganogramaInterno } from '@/components/rede/OrganogramaInterno'

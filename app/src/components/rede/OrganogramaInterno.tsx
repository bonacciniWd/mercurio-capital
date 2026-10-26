import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, GitBranch, Loader2, Plus, RefreshCw, ShieldCheck, Users, X } from 'lucide-react'
import type { Connection, Edge } from '@xyflow/react'
import { useAuth } from '@/auth/AuthContext'
import { adminNivelOf } from '@/lib/adminScope'
import { supabase } from '@/lib/supabase'
import {
  canAssignInternalManager, internalProfilePayload, layoutInternalOrg, profileDraft,
  type InternalEmployee, type InternalProfileDraft,
} from '@/lib/internalOrg'
import { NetworkCanvas, type NetworkCardNode } from './NetworkCanvas'
import { NetworkSearch } from './NetworkSearch'

type CatalogItem = { id: string; nome: string; ativo: boolean }
type Catalogs = { cargos: CatalogItem[]; departamentos: CatalogItem[] }
type TeamData = { people: InternalEmployee[]; catalogs: Catalogs }
const EMPTY_CATALOGS: Catalogs = { cargos: [], departamentos: [] }
const EMPTY_PEOPLE: InternalEmployee[] = []
const QUERY_KEY = ['admin-internal-org']

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('ciclo_hierarquia') || message.includes('sem_auto_gestor')) return 'Esse vínculo criaria um ciclo na hierarquia. Escolha outro gestor.'
  if (message.includes('gestor_deve_ser_admin_ativo')) return 'O gestor precisa ser um colaborador interno ativo.'
  if (message.includes('forbidden')) return 'Seu perfil não possui permissão para alterar a equipe interna.'
  return message
}

export function OrganogramaInterno() {
  const { session } = useAuth()
  const canEdit = adminNivelOf(session) === 'full'
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [selection, setSelection] = useState<{ id: string; version: number; manager?: string } | null>(null)
  const [feedback, setFeedback] = useState('')
  const selectPerson = useCallback((id: string) => { setFeedback(''); setSelection(current => ({ id, version: (current?.version ?? 0) + 1 })) }, [])

  const team = useQuery({
    queryKey: [...QUERY_KEY, canEdit ? 'edit' : 'read'], staleTime: 30_000, refetchOnWindowFocus: false,
    queryFn: async (): Promise<TeamData> => {
      const [peopleResult, catalogsResult] = await Promise.all([
        supabase.rpc(canEdit ? 'admin_internal_team_list' : 'admin_internal_team_graph'),
        canEdit ? supabase.rpc('admin_internal_team_catalogs') : Promise.resolve({ data: EMPTY_CATALOGS, error: null }),
      ])
      if (peopleResult.error) throw new Error(peopleResult.error.message)
      if (catalogsResult.error) throw new Error(catalogsResult.error.message)
      return { people: (peopleResult.data ?? []) as InternalEmployee[], catalogs: (catalogsResult.data ?? EMPTY_CATALOGS) as Catalogs }
    },
  })
  const people = team.data?.people ?? EMPTY_PEOPLE
  const activePeople = useMemo(() => people.filter(person => person.ativo !== false), [people])
  const photos = useQuery({
    queryKey: ['internal-org-photos', activePeople.map(person => person.foto_path).filter(Boolean)],
    enabled: activePeople.some(person => person.foto_path), staleTime: 240_000, refetchInterval: 240_000,
    queryFn: async () => Object.fromEntries(await Promise.all(activePeople.filter(person => person.foto_path).map(async person => {
      const { data } = await supabase.storage.from('avatares-internos').createSignedUrl(person.foto_path!, 300)
      return [person.foto_path!, data?.signedUrl ?? null]
    }))),
  })
  const layout = useMemo(() => layoutInternalOrg(activePeople), [activePeople])
  const graphNodes = useMemo<NetworkCardNode[]>(() => layout.positions.map(position => {
    const person = activePeople.find(entry => entry.usuario_id === position.id)!
    return { id: person.usuario_id, type: 'networkCard', position: { x: position.x, y: position.y }, data: {
      kind: 'person', label: person.nome_completo, subtitle: person.cargo || 'Cargo não atribuído',
      detail: person.departamento || 'Sem departamento', avatar: person.foto_path ? photos.data?.[person.foto_path] : null,
      actionLabel: canEdit ? 'Editar' : 'Detalhes',
    } }
  }), [activePeople, layout, photos.data, canEdit])
  const graphEdges = useMemo<Edge[]>(() => layout.connections.map(connection => ({ ...connection, type: 'smoothstep', style: { stroke: '#c6c8d0', strokeWidth: 1.5 } })), [layout])
  const departments = useMemo(() => [...new Set(activePeople.map(person => person.departamento).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [activePeople])
  const matches = useMemo(() => search.trim() || department ? new Set(activePeople.filter(person => (!department || person.departamento === department) && `${person.nome_completo} ${person.cargo ?? ''} ${person.departamento ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))).map(person => person.usuario_id)) : undefined, [activePeople, search, department])
  const selected = activePeople.find(person => person.usuario_id === selection?.id)

  function stageConnection(connection: Connection) {
    if (!canEdit || !canAssignInternalManager(activePeople, connection.target, connection.source)) return
    setFeedback('')
    setSelection(current => ({ id: connection.target, version: (current?.version ?? 0) + 1, manager: connection.source }))
  }

  return <>
    <div className="network-stats"><div><span><Users size={18} /></span><p>Colaboradores ativos<strong>{activePeople.length}</strong></p></div><div><span><Building2 size={18} /></span><p>Departamentos na equipe<strong>{departments.length}</strong></p></div><div><span><GitBranch size={18} /></span><p>Sem gestor atribuído<strong>{activePeople.filter(person => !person.gestor_usuario_id || !activePeople.some(manager => manager.usuario_id === person.gestor_usuario_id)).length}</strong></p></div></div>
    <div className="network-toolbar"><NetworkSearch value={search} onChange={setSearch} items={activePeople.filter(person => !department || person.departamento === department).map(person => ({ id: person.usuario_id, label: person.nome_completo, detail: `${person.cargo || 'Sem cargo'} · ${person.departamento || 'Sem departamento'}` }))} onSelect={selectPerson} placeholder="Localizar pessoa, cargo ou departamento" /><div className="network-toolbar__filters"><label>Departamento<select aria-label="Filtrar departamento" value={department} onChange={event => setDepartment(event.target.value)}><option value="">Todos os departamentos</option>{departments.map(name => <option key={name} value={name}>{name}</option>)}</select></label><button className="btn-no-liquid network-button" type="button" disabled={team.isFetching} onClick={() => void team.refetch()}><RefreshCw size={15} className={team.isFetching ? 'network-spin' : ''} /> Atualizar</button></div></div>
    {feedback && <p className="network-feedback" role="status"><Check size={15} />{feedback}</p>}
    <div className="network-workspace" data-inspector={Boolean(selected)}>
      <div className="network-map-panel"><div className="network-map-heading"><strong><GitBranch size={15} /> Organograma Mercúrio</strong><span>{canEdit ? 'Selecione uma pessoa para editar · Conecte gestor → colaborador para propor um vínculo' : 'Visualização da estrutura interna'}</span></div>
        {team.isLoading ? <div className="network-empty"><Loader2 size={25} className="network-spin" /><span>Carregando organograma…</span></div> : team.error ? <div className="network-empty" role="alert"><strong>Não foi possível carregar o organograma</strong><span>{readableError(team.error)}</span><button className="btn-no-liquid network-button" type="button" onClick={() => void team.refetch()}>Tentar novamente</button></div> : <NetworkCanvas nodes={graphNodes} edges={graphEdges} selectedId={selection?.id} highlightedIds={matches} onSelect={selectPerson} onConnect={canEdit ? stageConnection : undefined} canConnect={connection => canEdit && canAssignInternalManager(activePeople, connection.target, connection.source)} label="Organograma interno interativo" />}
      </div>
      {selected && selection && <OrgPersonEditor key={`${selection.id}:${selection.version}`} person={selected} people={people} catalogs={team.data?.catalogs ?? EMPTY_CATALOGS} canEdit={canEdit} proposedManager={selection.manager} onClose={() => setSelection(null)} onSaved={() => { setSelection(null); setFeedback(`Dados de ${selected.nome_completo} atualizados.`) }} />}
    </div>
  </>
}

function OrgPersonEditor({ person, people, catalogs, canEdit, proposedManager, onClose, onSaved }: {
  person: InternalEmployee; people: InternalEmployee[]; catalogs: Catalogs; canEdit: boolean
  proposedManager?: string; onClose: () => void; onSaved: () => void
}) {
  const qc = useQueryClient()
  const [baseline] = useState(person)
  const [draft, setDraft] = useState<InternalProfileDraft>(() => ({ ...profileDraft(person), ...(proposedManager ? { gestor: proposedManager } : {}) }))
  const [confirmed, setConfirmed] = useState(false)
  const [catalogType, setCatalogType] = useState<'cargo' | 'departamento' | null>(null)
  const [catalogName, setCatalogName] = useState('')
  const original = profileDraft(baseline)
  const dirty = (Object.keys(draft) as Array<keyof InternalProfileDraft>).some(field => draft[field] !== original[field])
  const managerChanged = draft.gestor !== original.gestor
  const currentManager = people.find(entry => entry.usuario_id === baseline.gestor_usuario_id)
  const nextManager = people.find(entry => entry.usuario_id === draft.gestor)
  const candidates = people.filter(entry => entry.ativo !== false && canAssignInternalManager(people, person.usuario_id, entry.usuario_id))

  const save = useMutation({
    mutationFn: async () => {
      if (!canEdit) throw new Error('forbidden')
      if (managerChanged && !confirmed) throw new Error('Confirme a alteração do gestor antes de salvar.')
      const { data, error } = await supabase.rpc('admin_internal_team_list')
      if (error) throw new Error(error.message)
      const latestPeople = (data ?? []) as InternalEmployee[]
      const latest = latestPeople.find(entry => entry.usuario_id === person.usuario_id)
      if (!latest || latest.ativo === false) throw new Error('O colaborador não está mais disponível. Atualize o organograma.')
      const payload = internalProfilePayload(baseline, draft, latest)
      if (!canAssignInternalManager(latestPeople, person.usuario_id, payload.p_gestor_usuario_id)) throw new Error('Esse vínculo criaria um ciclo ou usa um gestor indisponível. Escolha outro gestor.')
      for (const [list, id, name] of [[catalogs.cargos, payload.p_cargo_id, 'cargo'], [catalogs.departamentos, payload.p_departamento_id, 'departamento']] as const) {
        if (id && !list.some(entry => entry.id === id && entry.ativo)) throw new Error(`Escolha um ${name} ativo para salvar o perfil.`)
      }
      const { error: saveError } = await supabase.rpc('admin_internal_team_update', payload)
      if (saveError) throw new Error(saveError.message)
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: QUERY_KEY }); onSaved() },
  })
  const createCatalog = useMutation({
    mutationFn: async ({ type, name }: { type: 'cargo' | 'departamento'; name: string }) => {
      if (!canEdit) throw new Error('forbidden')
      const { data, error } = await supabase.rpc('admin_internal_team_catalog_upsert', { p_tipo: type, p_id: null, p_nome: name.trim(), p_descricao: null, p_ativo: true })
      if (error) throw new Error(error.message)
      if (typeof data !== 'string') throw new Error('O cadastro não retornou um identificador. Atualize os dados antes de atribuir.')
      return { id: data, type, name: name.trim() }
    },
    onSuccess: ({ id, type, name }) => {
      qc.setQueryData<TeamData>([...QUERY_KEY, 'edit'], current => current ? { ...current, catalogs: { ...current.catalogs, [type === 'cargo' ? 'cargos' : 'departamentos']: [...current.catalogs[type === 'cargo' ? 'cargos' : 'departamentos'].filter(item => item.id !== id), { id, nome: name, ativo: true }] } } : current)
      setDraft(current => ({ ...current, [type]: id }))
      setCatalogType(null); setCatalogName('')
    },
  })
  const busy = save.isPending || createCatalog.isPending
  function change(field: keyof InternalProfileDraft, value: string) {
    setDraft(current => ({ ...current, [field]: value }))
    if (field === 'gestor') setConfirmed(false)
    save.reset()
  }

  return <aside className="network-inspector" aria-label={`Perfil de ${person.nome_completo}`}>
    <header><span className="network-eyebrow">{canEdit ? 'Editar colaborador' : 'Detalhes do colaborador'}</span><button className="btn-no-liquid network-close" type="button" disabled={busy} aria-label="Fechar perfil" onClick={onClose}><X size={17} /></button></header>
    <span className="network-person-icon"><Users size={25} /></span><h2>{person.nome_completo}</h2><p>{person.cargo || 'Cargo não atribuído'}</p>
    {!canEdit ? <><dl><div><dt>Departamento</dt><dd>{person.departamento || 'Não informado'}</dd></div><div><dt>Gestor direto</dt><dd>{currentManager?.nome_completo ?? 'Sem gestor ativo'}</dd></div><div><dt>Início</dt><dd>{person.data_inicio ? new Date(`${person.data_inicio}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado'}</dd></div></dl><div className="network-note"><ShieldCheck size={15} /> Seu perfil possui acesso de leitura.</div></> : <form onSubmit={event => { event.preventDefault(); save.mutate() }}>
      <fieldset disabled={busy}>
        <div className="network-editor-heading"><h3>Dados organizacionais</h3>{dirty && <span>Alterações pendentes</span>}</div>
        {(['cargo', 'departamento'] as const).map(type => {
          const list = type === 'cargo' ? catalogs.cargos : catalogs.departamentos
          const value = draft[type]
          return <div className="network-editor-field" key={type}><label htmlFor={`org-${type}`}>{type === 'cargo' ? 'Cargo' : 'Departamento'}</label><select id={`org-${type}`} value={value} onChange={event => change(type, event.target.value)}><option value="">{type === 'cargo' ? 'Sem cargo' : 'Sem departamento'}</option>{list.filter(item => item.ativo || item.id === value).map(item => <option key={item.id} value={item.id}>{item.nome}{item.ativo ? '' : ' (inativo)'}</option>)}{value && !list.some(item => item.id === value) && <option value={value}>Cadastro indisponível</option>}</select><button className="btn-no-liquid network-text-button" type="button" onClick={() => { setCatalogType(type); setCatalogName(''); createCatalog.reset() }}><Plus size={12} />{type === 'cargo' ? 'Novo cargo' : 'Novo departamento'}</button></div>
        })}
        {catalogType && <div className="network-catalog-create"><label htmlFor="org-catalog-name">{catalogType === 'cargo' ? 'Nome do novo cargo' : 'Nome do novo departamento'}</label><input id="org-catalog-name" value={catalogName} onChange={event => setCatalogName(event.target.value)} minLength={2} maxLength={100} placeholder="Digite o nome" /><div><button className="btn-no-liquid network-button" type="button" onClick={() => setCatalogType(null)}>Cancelar</button><button className="btn-no-liquid network-button network-button--primary" type="button" disabled={catalogName.trim().length < 2} onClick={() => createCatalog.mutate({ type: catalogType, name: catalogName })}>{createCatalog.isPending ? <Loader2 size={14} className="network-spin" /> : <Plus size={14} />} Criar</button></div>{createCatalog.error && <p className="network-field-error" role="alert">{readableError(createCatalog.error)}</p>}</div>}
        <div className="network-editor-field"><label htmlFor="org-manager">Gestor direto</label><select id="org-manager" value={draft.gestor} onChange={event => change('gestor', event.target.value)}><option value="">Sem gestor</option>{candidates.map(entry => <option key={entry.usuario_id} value={entry.usuario_id}>{entry.nome_completo}</option>)}{draft.gestor && !candidates.some(entry => entry.usuario_id === draft.gestor) && <option value={draft.gestor}>Gestor indisponível — substitua</option>}</select></div>
        <div className="network-editor-field"><label htmlFor="org-start-date">Data de início</label><input id="org-start-date" type="date" value={draft.dataInicio} onChange={event => change('dataInicio', event.target.value)} /></div>
        {managerChanged && <div className="network-manager-change"><strong>Alteração de gestão</strong><p>{currentManager?.nome_completo ?? 'Sem gestor'} → {nextManager?.nome_completo ?? 'Sem gestor'}</p><label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirmo a alteração do gestor direto</label></div>}
        <div className="network-note"><ShieldCheck size={14} /> Cargo e departamento não alteram o nível de acesso.</div>
        {save.error && <p className="network-field-error" role="alert">{readableError(save.error)}</p>}
        <div className="network-editor-actions"><button className="btn-no-liquid network-button" type="button" onClick={onClose}>Cancelar</button><button className="btn-no-liquid network-button network-button--primary" type="submit" disabled={!dirty || (managerChanged && !confirmed)}>{save.isPending ? <Loader2 size={15} className="network-spin" /> : <Check size={15} />} Salvar alterações</button></div>
      </fieldset>
    </form>}
  </aside>
}

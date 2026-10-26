import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, CheckCheck, GitBranch, Loader2, Network, RefreshCw, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RedeFlowCanvas, type RedeGraph } from '@/components/rede/RedeFlow'
import { OrganogramaInterno } from '@/components/rede/OrganogramaInterno'
import { NetworkSearch } from '@/components/rede/NetworkSearch'
import './rede.css'

type NetworkView = 'origination' | 'internal'
const EMPTY_GRAPH: RedeGraph = { nodes: [], edges: [] }

export function AdminRede() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('approved')
  const [limit, setLimit] = useState(20)
  const [view, setView] = useState<NetworkView>('origination')
  const [internalVisited, setInternalVisited] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectNode = useCallback((id: string) => setSelectedId(id), [])

  const graphQuery = useQuery({
    queryKey: ['admin-rede', status, limit], enabled: view === 'origination',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_rede_graph', { p_status: status || null, p_limit: limit })
      if (error) throw new Error(error.message)
      return (data ?? EMPTY_GRAPH) as RedeGraph
    },
  })
  const refresh = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_refresh_mvs')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rede'] }),
  })
  const graph = graphQuery.data ?? EMPTY_GRAPH
  const highlighted = useMemo(() => search.trim() ? new Set(graph.nodes.filter(node => node.label.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))).map(node => node.id)) : undefined, [graph, search])
  const selected = graph.nodes.find(node => node.id === selectedId)

  function changeView(next: NetworkView) { setView(next); if (next === 'internal') setInternalVisited(true) }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'origination' : event.key === 'End' ? 'internal' : view === 'origination' ? 'internal' : 'origination'
    changeView(next)
    document.getElementById(`network-tab-${next}`)?.focus()
  }

  return <section className="admin-network" aria-labelledby="network-title">
    <header className="network-heading"><div><span className="network-eyebrow">Gestão de relacionamentos</span><h1 id="network-title">Rede e organograma</h1><p>Acompanhe sua rede de parceiros e organize a equipe Mercúrio.</p></div><div className="network-tabs" role="tablist" aria-label="Visualização da rede">
      {([{ id: 'origination', label: 'Rede de originação', icon: Network }, { id: 'internal', label: 'Organograma interno', icon: Users }] as const).map(tab => <button className="btn-no-liquid" role="tab" type="button" key={tab.id} id={`network-tab-${tab.id}`} aria-controls={`network-panel-${tab.id}`} aria-selected={view === tab.id} tabIndex={view === tab.id ? 0 : -1} onKeyDown={navigateTabs} onClick={() => changeView(tab.id)}><tab.icon size={15} />{tab.label}</button>)}
    </div></header>

    <div id="network-panel-origination" role="tabpanel" aria-labelledby="network-tab-origination" hidden={view !== 'origination'}>
      <div className="network-stats"><div><span><Building2 size={18} /></span><p>Parceiros exibidos<strong>{graph.nodes.filter(node => node.tipo === 'partner').length}</strong></p></div><div><span><Users size={18} /></span><p>Equipes no mapa<strong>{graph.nodes.filter(node => node.tipo === 'equipe').length}</strong></p></div><div><span><CheckCheck size={18} /></span><p>Propostas dos parceiros<strong>{graph.nodes.reduce((total, node) => total + (node.tipo === 'partner' ? node.propostas ?? 0 : 0), 0)}</strong></p></div></div>
      <div className="network-toolbar"><NetworkSearch value={search} onChange={setSearch} items={graph.nodes.map(node => ({ id: node.id, label: node.label, detail: node.tipo === 'partner' ? 'Parceiro' : node.tipo === 'equipe' ? 'Equipe' : 'Mercúrio' }))} onSelect={selectNode} placeholder="Localizar parceiro ou equipe" /><div className="network-toolbar__filters"><label>Status<select aria-label="Status dos parceiros" value={status} onChange={event => setStatus(event.target.value)}><option value="approved">Aprovados</option><option value="pending">Pendentes</option><option value="suspended">Suspensos</option><option value="rejected">Recusados</option><option value="">Todos</option></select></label><label>Exibir<select aria-label="Quantidade de parceiros" value={limit} onChange={event => setLimit(Number(event.target.value))}>{[10, 20, 50, 100].map(number => <option key={number} value={number}>{number} parceiros</option>)}</select></label><button className="btn-no-liquid network-button" type="button" disabled={refresh.isPending} onClick={() => refresh.mutate()}>{refresh.isPending ? <Loader2 className="network-spin" size={15} /> : <RefreshCw size={15} />} Atualizar dados</button></div></div>
      {refresh.error && <p className="network-feedback is-error" role="alert">{refresh.error.message}</p>}
      <div className="network-workspace" data-inspector={Boolean(selected)}><div className="network-map-panel"><div className="network-map-heading"><strong><GitBranch size={15} /> Rede de originação</strong><span>Parceiros e equipes vinculadas</span></div>{graphQuery.isLoading ? <div className="network-empty"><Loader2 className="network-spin" size={25} /><span>Carregando rede…</span></div> : graphQuery.error ? <div className="network-empty" role="alert"><strong>Não foi possível carregar a rede</strong><span>{graphQuery.error.message}</span><button className="btn-no-liquid network-button" type="button" onClick={() => void graphQuery.refetch()}>Tentar novamente</button></div> : <RedeFlowCanvas graph={graph} variant="admin" selectedId={selectedId} highlightedIds={highlighted} onSelect={selectNode} />}</div>
        {selected && <aside className="network-inspector" aria-label="Detalhes da conexão"><header><span className="network-eyebrow">Detalhes da conexão</span><button className="btn-no-liquid network-close" type="button" aria-label="Fechar detalhes" onClick={() => setSelectedId(null)}><X size={17} /></button></header><span className="network-person-icon"><Building2 size={25} /></span><h2>{selected.label}</h2><p>{selected.tipo === 'partner' ? 'Parceiro originador' : selected.tipo === 'equipe' ? 'Equipe de parceiro' : 'Mercúrio Capital'}</p><dl><div><dt>Tipo de vínculo</dt><dd>{selected.tipo === 'partner' ? 'Parceiro' : selected.tipo === 'equipe' ? 'Equipe' : 'Administração'}</dd></div>{selected.tipo === 'partner' && <><div><dt>Status</dt><dd>{{ approved: 'Aprovado', pending: 'Pendente', rejected: 'Recusado', suspended: 'Suspenso' }[selected.status ?? 'pending'] ?? 'Sem status'}</dd></div><div><dt>Propostas</dt><dd>{selected.propostas ?? 0}</dd></div></>}{selected.tipo === 'equipe' && <div><dt>Membros</dt><dd>{selected.membros ?? 0}</dd></div>}</dl><div className="network-note">Arraste o card para ajustar sua posição no mapa.</div></aside>}
      </div>
    </div>
    <div id="network-panel-internal" role="tabpanel" aria-labelledby="network-tab-internal" hidden={view !== 'internal'}>{internalVisited && <OrganogramaInterno />}</div>
  </section>
}

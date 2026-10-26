import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Mail, Copy, Check, Trash2, Loader2, Users, AlertTriangle, Network, Building2, X, Grip } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { RedeFlowCanvas, type RedeGraph } from '@/components/rede/RedeFlow'
import { publicAppUrl } from '@/lib/publicUrl'
import '../admin/rede.css'

interface Equipe {
  id: string
  partner_id: string
  nome: string
  isolamento_estrito: boolean
  created_at: string
}
interface Membro {
  id: string
  equipe_id: string
  usuario_id: string
  nome_completo: string
  email: string
  papel_equipe: 'admin_equipe' | 'membro'
  aceito_em: string | null
}
interface Convite {
  id: string
  equipe_id: string
  email: string
  nome: string | null
  papel_equipe: 'admin_equipe' | 'membro'
  expires_at: string
  created_at: string
}

interface InviteResponse {
  convite_token: string
  equipe_id: string
  email: string
  expires_in_min: number
  email_status?: string
  email_erro?: string
}

interface InviteResult {
  url: string
  emailStatus: string | null
  emailError: string | null
}

function getEquipeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Falha ao executar ação na equipe.'
  const normalized = raw.toLowerCase()

  if (normalized.includes('no api key found')) {
    return 'Falha de autenticação com a API. Recarregue a página e tente novamente.'
  }

  if (normalized.includes('digest(') && normalized.includes('does not exist')) {
    return 'Ambiente de banco desatualizado para convites. Solicite aplicação da migration mais recente.'
  }

  return raw
}

export function PartnerEquipe() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [creatingEquipe, setCreatingEquipe] = useState(false)
  const [novaEquipeNome, setNovaEquipeNome] = useState('')
  const [novaEquipeIsolada, setNovaEquipeIsolada] = useState(false)
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista')
  const [selectedMapNodeId, setSelectedMapNodeId] = useState<string | null>(null)
  const [selectedEquipe, setSelectedEquipe] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [invitePapel, setInvitePapel] = useState<'membro' | 'admin_equipe'>('membro')
  const [lastInviteResult, setLastInviteResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  const equipesQuery = useQuery({
    queryKey: ['p-equipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes')
        .select('id, partner_id, nome, isolamento_estrito, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Equipe[]
    },
  })

  const membrosQuery = useQuery({
    queryKey: ['p-membros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_membros_detalhe')
        .select('id, equipe_id, usuario_id, nome_completo, email, papel_equipe, aceito_em')
      if (error) throw error
      return (data ?? []) as Membro[]
    },
  })

  const convitesQuery = useQuery({
    queryKey: ['p-convites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_convites_pendentes')
        .select('id, equipe_id, email, nome, papel_equipe, expires_at, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Convite[]
    },
  })

  const mapaQuery = useQuery({
    queryKey: ['p-rede-graph'],
    enabled: viewMode === 'mapa' && session?.role === 'partner',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_rede_graph')
      if (error) throw error
      return (data ?? { nodes: [], edges: [] }) as RedeGraph
    },
  })

  const criarEquipe = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('partner_create_equipe', {
        p_nome: novaEquipeNome,
        p_isolamento_estrito: novaEquipeIsolada,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      setCreatingEquipe(false)
      setNovaEquipeNome('')
      setNovaEquipeIsolada(false)
      qc.invalidateQueries({ queryKey: ['p-equipes'] })
    },
  })

  const convidar = useMutation({
    mutationFn: async () => {
      if (!selectedEquipe) throw new Error('Selecione uma equipe')
      const { data, error } = await supabase.rpc('partner_invite_membro', {
        p_equipe_id: selectedEquipe,
        p_email: inviteEmail,
        p_nome: inviteNome,
        p_papel_equipe: invitePapel,
        p_permissoes: {},
      })
      if (error) throw error
      const payload = (data ?? {}) as InviteResponse
      const token = payload.convite_token
      return {
        url: publicAppUrl(`/convite/${token}`),
        emailStatus: payload.email_status ?? null,
        emailError: payload.email_erro ?? null,
      }
    },
    onSuccess: (result) => {
      setLastInviteResult(result)
      setInviteEmail('')
      setInviteNome('')
      qc.invalidateQueries({ queryKey: ['p-convites'] })
    },
  })

  const removerMembro = useMutation({
    mutationFn: async (v: { equipe_id: string; usuario_id: string }) => {
      const { error } = await supabase.rpc('partner_remove_membro', {
        p_equipe_id: v.equipe_id,
        p_usuario_id: v.usuario_id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['p-membros'] }),
    onError: (err) => {
      alert(getEquipeErrorMessage(err))
    },
  })

  const equipes = equipesQuery.data ?? []
  const membros = membrosQuery.data ?? []
  const convites = convitesQuery.data ?? []
  const canViewMapa = session?.role === 'partner'
  const selectedMapNode = mapaQuery.data?.nodes.find(node => node.id === selectedMapNodeId) ?? null

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Minha equipe</h1>
          <p className="text-sm text-silver-600">Gerencie equipes e convide membros para sua operação.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-no-liquid" onClick={() => setCreatingEquipe(v => !v)}>
            <Users className="h-4 w-4" /> Nova equipe
          </button>
          <button
            className="btn-no-liquid"
            disabled={equipes.length === 0}
            onClick={() => {
              setSelectedEquipe(equipes[0]?.id ?? null)
              setInviteOpen(true)
              setLastInviteResult(null)
            }}
          >
            <Plus className="h-4 w-4" /> Convidar membro
          </button>
        </div>
      </div>

      <div className="mb-6 inline-flex overflow-hidden rounded-md gap-2 border-silver-200 bg-white shadow-sm">
        <button
          className={`btn-no-liquid px-3 py-2 text-sm font-medium ${viewMode === 'lista' ? 'bg-navy text-white' : 'text-silver-700 hover:bg-silver-50'}`}
          onClick={() => setViewMode('lista')}
        >
          Lista
        </button>
        <button
          className={`btn-no-liquid inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${viewMode === 'mapa' ? 'bg-navy text-white' : 'text-silver-700 hover:bg-silver-50 disabled:cursor-not-allowed disabled:text-silver-400 disabled:hover:bg-white'}`}
          onClick={() => setViewMode('mapa')}
          disabled={!canViewMapa}
          title={canViewMapa ? 'Visualizar mapa da equipe' : 'Somente partner pode visualizar o mapa'}
        >
          <Network className="h-4 w-4" /> Mapa
        </button>
      </div>

      {creatingEquipe && (
        <div className="card mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Criar equipe</h2>
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <input
              className="input"
              placeholder="Nome da equipe"
              value={novaEquipeNome}
              onChange={e => setNovaEquipeNome(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-silver-700">
              <input type="checkbox" checked={novaEquipeIsolada} onChange={e => setNovaEquipeIsolada(e.target.checked)} />
              Isolamento estrito
            </label>
            <button
              className="btn-no-liquid btn-gold"
              disabled={criarEquipe.isPending || novaEquipeNome.trim().length < 2}
              onClick={() => criarEquipe.mutate()}
            >
              {criarEquipe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </button>
          </div>
          {criarEquipe.isError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {getEquipeErrorMessage(criarEquipe.error)}
            </p>
          )}
        </div>
      )}

      {inviteOpen && (
        <div className="card mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Convidar membro</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <select className="input" value={selectedEquipe ?? ''} onChange={e => setSelectedEquipe(e.target.value)}>
              <option value="">Selecione a equipe</option>
              {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
            <input className="input" placeholder="Nome" value={inviteNome} onChange={e => setInviteNome(e.target.value)} />
            <input className="input" placeholder="E-mail" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <select className="input" value={invitePapel} onChange={e => setInvitePapel(e.target.value as 'membro' | 'admin_equipe')}>
              <option value="membro">Membro</option>
              <option value="admin_equipe">Admin da equipe</option>
            </select>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-no-liquid btn-ghost" onClick={() => { setInviteOpen(false); setLastInviteResult(null) }}>Fechar</button>
            <button
              className="btn-no-liquid btn-gold"
              disabled={convidar.isPending || !selectedEquipe || inviteEmail.length < 5}
              onClick={() => convidar.mutate()}
            >
              {convidar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar convite'}
            </button>
          </div>
          {lastInviteResult?.url && (
            <div className="mt-4 rounded-md border border-silver-200 bg-silver-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Link de convite (válido 30 min)</p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly className="input flex-1 font-mono text-xs" value={lastInviteResult.url} />
                <button
                  className="btn-no-liquid btn-outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(lastInviteResult.url)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              {lastInviteResult.emailStatus === 'enfileirado' && (
                <p className="mt-2 rounded-md border border-success/20 bg-success/5 px-3 py-2 text-xs text-success">
                  E-mail transacional enfileirado automaticamente para o convidado.
                </p>
              )}

              {lastInviteResult.emailStatus === 'falha_enqueue' && (
                <p className="mt-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold-700">
                  Convite gerado, mas houve falha ao enfileirar o e-mail automático. Use o link acima para envio manual.
                </p>
              )}

              {lastInviteResult.emailStatus !== 'enfileirado' && lastInviteResult.emailStatus !== 'falha_enqueue' && (
                <p className="mt-2 rounded-md border border-silver-200 bg-white px-3 py-2 text-xs text-silver-600">
                  Convite gerado com sucesso. Caso necessário, copie o link e envie manualmente ao membro.
                </p>
              )}

              {lastInviteResult.emailError && (
                <p className="mt-2 text-[11px] text-silver-500">Detalhe técnico do envio automático: {lastInviteResult.emailError}</p>
              )}
            </div>
          )}
          {convidar.isError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {getEquipeErrorMessage(convidar.error)}
            </p>
          )}
        </div>
      )}

      {viewMode === 'mapa' ? (
        <section className="admin-network partner-team-network" aria-label="Mapa da equipe">
          {!canViewMapa ? (
            <div className="network-empty">
              <Network size={30} />
              <strong>Mapa disponível para o parceiro titular</strong>
              A visualização de mapa é exclusiva para o parceiro titular da conta.
            </div>
          ) : mapaQuery.isLoading ? (
            <div className="network-empty" role="status">
              <Loader2 className="network-spin" size={25} />
              <span>Carregando mapa da equipe…</span>
            </div>
          ) : mapaQuery.error ? (
            <div className="network-empty" role="alert">
              <strong>Não foi possível carregar o mapa</strong>
              <span>{(mapaQuery.error as Error).message}</span>
              <button className="btn-no-liquid network-button" type="button" onClick={() => void mapaQuery.refetch()}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="network-workspace" data-inspector={Boolean(selectedMapNode)}>
              <div className="network-map-panel">
                <div className="network-map-heading">
                  <strong><Network size={15} /> Minha equipe</strong>
                  <span>Arraste os cards para organizar a visualização</span>
                </div>
                <RedeFlowCanvas
                  graph={mapaQuery.data ?? { nodes: [], edges: [] }}
                  variant="partner"
                  selectedId={selectedMapNodeId}
                  onSelect={setSelectedMapNodeId}
                />
              </div>
              {selectedMapNode && (
                <aside className="network-inspector" aria-label="Detalhes do item selecionado no mapa">
                  <header>
                    <span className="network-eyebrow">Detalhes do mapa</span>
                    <button className="btn-no-liquid network-close" type="button" aria-label="Fechar detalhes" onClick={() => setSelectedMapNodeId(null)}>
                      <X size={17} />
                    </button>
                  </header>
                  <span className="network-person-icon">
                    {selectedMapNode.tipo === 'partner' ? <Building2 size={24} /> : <Users size={24} />}
                  </span>
                  <h2>{selectedMapNode.label}</h2>
                  <p>{selectedMapNode.tipo === 'partner' ? 'Parceiro titular da conta' : 'Equipe da sua operação'}</p>
                  <dl>
                    <div>
                      <dt>Tipo de vínculo</dt>
                      <dd>{selectedMapNode.tipo === 'partner' ? 'Parceiro' : 'Equipe'}</dd>
                    </div>
                    {selectedMapNode.tipo === 'partner' ? (
                      <>
                        <div>
                          <dt>Status</dt>
                          <dd>{{ approved: 'Aprovado', pending: 'Pendente', rejected: 'Recusado', suspended: 'Suspenso' }[selectedMapNode.status ?? 'pending'] ?? 'Sem status'}</dd>
                        </div>
                        <div>
                          <dt>Propostas originadas</dt>
                          <dd>{selectedMapNode.propostas ?? 0}</dd>
                        </div>
                      </>
                    ) : (
                      <div>
                        <dt>Membros ativos</dt>
                        <dd>{selectedMapNode.membros ?? 0}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="network-note"><Grip size={13} /> Arrastar altera apenas a posição visual; não muda os vínculos da equipe.</div>
                </aside>
              )}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {equipes.length === 0 ? (
              <p className="text-sm text-silver-500">Nenhuma equipe cadastrada ainda.</p>
            ) : equipes.map(eq => {
              const membrosEq = membros.filter(m => m.equipe_id === eq.id)
              return (
                <div key={eq.id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-navy">{eq.nome}</h3>
                      <p className="text-xs text-silver-500">{membrosEq.length} membro(s)</p>
                    </div>
                    {eq.isolamento_estrito && <span className="badge bg-gold/15 text-gold-700">Isolada</span>}
                  </div>
                  <ul className="mt-4 space-y-2">
                    {membrosEq.length === 0 ? (
                      <li className="text-xs text-silver-400">Sem membros.</li>
                    ) : membrosEq.map(m => (
                      <li key={m.id} className="flex items-center justify-between rounded-md bg-silver-50 p-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-silver-900">{m.nome_completo}</p>
                          <p className="truncate text-xs text-silver-500">{m.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="badge bg-navy/10 text-navy text-[10px]">
                            {m.papel_equipe === 'admin_equipe' ? 'Admin' : 'Membro'}
                          </span>
                          <button
                            className="btn-no-liquid rounded p-1 text-silver-500 hover:bg-white hover:text-danger"
                            title="Remover"
                            onClick={() => {
                              if (confirm(`Remover ${m.nome_completo} da equipe?`)) {
                                removerMembro.mutate({ equipe_id: eq.id, usuario_id: m.usuario_id })
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-navy">Convites pendentes</h2>
            {convites.length === 0 ? (
              <p className="text-sm text-silver-500">Nenhum convite pendente.</p>
            ) : (
              <ul className="space-y-2">
                {convites.map(c => {
                  const eq = equipes.find(e => e.id === c.equipe_id)
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-silver-50 p-3 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 text-silver-500" />
                        <span className="font-medium text-silver-900">{c.email}</span>
                        {c.nome && <span className="text-silver-500">· {c.nome}</span>}
                      </span>
                      <span className="text-xs text-silver-500">{eq?.nome ?? '—'}</span>
                      <span className="text-xs text-silver-500">expira em {new Date(c.expires_at).toLocaleString('pt-BR')}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  )
}

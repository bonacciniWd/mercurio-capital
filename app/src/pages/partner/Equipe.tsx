import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Mail, Copy, Check, Trash2, Loader2, Users, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

export function PartnerEquipe() {
  const qc = useQueryClient()
  const [creatingEquipe, setCreatingEquipe] = useState(false)
  const [novaEquipeNome, setNovaEquipeNome] = useState('')
  const [novaEquipeIsolada, setNovaEquipeIsolada] = useState(false)
  const [selectedEquipe, setSelectedEquipe] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [invitePapel, setInvitePapel] = useState<'membro' | 'admin_equipe'>('membro')
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
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
      const token = (data as { convite_token: string }).convite_token
      return `${window.location.origin}/convite/${token}`
    },
    onSuccess: (url) => {
      setLastInviteUrl(url)
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
  })

  const equipes = equipesQuery.data ?? []
  const membros = membrosQuery.data ?? []
  const convites = convitesQuery.data ?? []

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Minha equipe</h1>
          <p className="text-sm text-silver-600">Gerencie equipes e convide membros para sua operação.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => setCreatingEquipe(v => !v)}>
            <Users className="h-4 w-4" /> Nova equipe
          </button>
          <button
            className="btn-gold"
            disabled={equipes.length === 0}
            onClick={() => {
              setSelectedEquipe(equipes[0]?.id ?? null)
              setInviteOpen(true)
              setLastInviteUrl(null)
            }}
          >
            <Plus className="h-4 w-4" /> Convidar membro
          </button>
        </div>
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
              className="btn-gold"
              disabled={criarEquipe.isPending || novaEquipeNome.trim().length < 2}
              onClick={() => criarEquipe.mutate()}
            >
              {criarEquipe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </button>
          </div>
          {criarEquipe.isError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {(criarEquipe.error as Error).message}
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
            <button className="btn-ghost" onClick={() => { setInviteOpen(false); setLastInviteUrl(null) }}>Fechar</button>
            <button
              className="btn-gold"
              disabled={convidar.isPending || !selectedEquipe || inviteEmail.length < 5}
              onClick={() => convidar.mutate()}
            >
              {convidar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar convite'}
            </button>
          </div>
          {lastInviteUrl && (
            <div className="mt-4 rounded-md border border-silver-200 bg-silver-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Link de convite (válido 30 min)</p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly className="input flex-1 font-mono text-xs" value={lastInviteUrl} />
                <button
                  className="btn-outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(lastInviteUrl)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
          {convidar.isError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {(convidar.error as Error).message}
            </p>
          )}
        </div>
      )}

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
                        className="rounded p-1 text-silver-500 hover:bg-white hover:text-danger"
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
  )
}

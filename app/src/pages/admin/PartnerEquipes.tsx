import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Loader2, AlertCircle, Users, ShieldOff,
  UserMinus, MailX, Mail, Lock, Unlock, Clock, CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/Badge'

type PartnerHeader = {
  partner_id: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  nome: string
  email: string
  equipes_count: number
  membros_count: number
}

type EquipeRow = {
  equipe_id: string
  partner_id: string
  nome: string
  isolamento_estrito: boolean
  created_at: string
  membros_total: number
  membros_suspensos: number
  convites_abertos: number
}

type MembroRow = {
  id: string
  equipe_id: string
  partner_id: string
  usuario_id: string
  nome_completo: string | null
  email: string | null
  papel_equipe: 'admin_equipe' | 'membro'
  permissoes: Record<string, unknown> | null
  aceito_em: string | null
  created_at: string
}

type ConviteRow = {
  id: string
  equipe_id: string
  partner_id: string
  email: string | null
  nome: string | null
  papel_equipe: 'admin_equipe' | 'membro' | null
  expires_at: string
  created_at: string
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  try { return new Date(s).toLocaleString('pt-BR') } catch { return '—' }
}

function isSuspenso(permissoes: Record<string, unknown> | null) {
  if (!permissoes) return false
  const v = (permissoes as { suspenso?: unknown }).suspenso
  return v === true || v === 'true'
}

export function AdminPartnerEquipes() {
  const { partnerId = '' } = useParams<{ partnerId: string }>()
  const qc = useQueryClient()
  const [confirmRemove, setConfirmRemove] = useState<{ equipe_id: string; usuario_id: string; nome: string } | null>(null)

  const partnerQuery = useQuery({
    queryKey: ['admin-partner-header', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partners')
        .select('partner_id, status, nome, email, equipes_count, membros_count')
        .eq('partner_id', partnerId)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as PartnerHeader | null
    },
  })

  const equipesQuery = useQuery({
    queryKey: ['admin-partner-equipes', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partner_equipes')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as EquipeRow[]
    },
  })

  const membrosQuery = useQuery({
    queryKey: ['admin-partner-membros', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_membros_detalhe')
        .select('id, equipe_id, partner_id, usuario_id, nome_completo, email, papel_equipe, permissoes, aceito_em, created_at')
        .eq('partner_id', partnerId)
      if (error) throw error
      return (data ?? []) as MembroRow[]
    },
  })

  const convitesQuery = useQuery({
    queryKey: ['admin-partner-equipe-convites', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_convites_pendentes')
        .select('id, equipe_id, partner_id, email, nome, papel_equipe, expires_at, created_at')
        .eq('partner_id', partnerId)
      if (error) throw error
      return (data ?? []) as ConviteRow[]
    },
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-partner-equipes', partnerId] })
    qc.invalidateQueries({ queryKey: ['admin-partner-membros', partnerId] })
    qc.invalidateQueries({ queryKey: ['admin-partner-equipe-convites', partnerId] })
  }

  const suspendMembro = useMutation({
    mutationFn: async (vars: { equipe_id: string; usuario_id: string; suspenso: boolean }) => {
      const { error } = await supabase.rpc('admin_set_equipe_membro_suspenso', {
        p_equipe_id: vars.equipe_id,
        p_usuario_id: vars.usuario_id,
        p_suspenso: vars.suspenso,
      })
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const removeMembro = useMutation({
    mutationFn: async (vars: { equipe_id: string; usuario_id: string }) => {
      const { error } = await supabase.rpc('partner_remove_membro', {
        p_equipe_id: vars.equipe_id,
        p_usuario_id: vars.usuario_id,
      })
      if (error) throw error
    },
    onSuccess: () => { invalidateAll(); setConfirmRemove(null) },
  })

  const revokeConvite = useMutation({
    mutationFn: async (magic_link_id: string) => {
      const { error } = await supabase.rpc('admin_revoke_equipe_membro_convite', {
        p_magic_link_id: magic_link_id,
      })
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const partner = partnerQuery.data
  const equipes = equipesQuery.data ?? []
  const membros = membrosQuery.data ?? []
  const convites = convitesQuery.data ?? []

  const membrosByEquipe = useMemo(() => {
    const m = new Map<string, MembroRow[]>()
    for (const row of membros) {
      if (!m.has(row.equipe_id)) m.set(row.equipe_id, [])
      m.get(row.equipe_id)!.push(row)
    }
    return m
  }, [membros])

  const convitesByEquipe = useMemo(() => {
    const m = new Map<string, ConviteRow[]>()
    for (const row of convites) {
      if (!m.has(row.equipe_id)) m.set(row.equipe_id, [])
      m.get(row.equipe_id)!.push(row)
    }
    return m
  }, [convites])

  const loading =
    partnerQuery.isLoading ||
    equipesQuery.isLoading ||
    membrosQuery.isLoading ||
    convitesQuery.isLoading

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-silver-500">
        <Link to="/admin/parceiros" className="hover:text-navy">
          <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Parceiros
        </Link>
        <span>/</span>
        <span className="text-navy">{partner?.nome ?? '...'}</span>
        <span>/</span>
        <span>Equipes</span>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Equipes do parceiro</h1>
          <p className="text-sm text-silver-500">
            {partner?.nome ?? '...'} · <span className="font-mono">{partner?.email ?? '...'}</span>
          </p>
        </div>
        {partner && (
          <Badge variant={partner.status === 'approved' ? 'green' : partner.status === 'suspended' ? 'red' : 'yellow'}>
            {partner.status}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : !partner ? (
        <div className="card p-5">
          <p className="text-sm text-danger">
            <AlertCircle className="mr-1 inline h-4 w-4" /> Parceiro não encontrado.
          </p>
        </div>
      ) : equipes.length === 0 ? (
        <div className="card p-8 text-center text-silver-500">
          <Users className="mx-auto mb-2 h-8 w-8 text-silver-300" />
          <p className="text-sm">Este parceiro ainda não criou nenhuma equipe.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {equipes.map((eq) => {
            const ms = membrosByEquipe.get(eq.equipe_id) ?? []
            const cs = convitesByEquipe.get(eq.equipe_id) ?? []
            return (
              <div key={eq.equipe_id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-silver-100 bg-silver-50/40 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-red-600" />
                    <div>
                      <h2 className="font-semibold text-navy">{eq.nome}</h2>
                      <p className="text-xs text-silver-500">
                        Criada em {fmtDate(eq.created_at)} · {eq.membros_total} membros
                        {eq.membros_suspensos > 0 ? ` · ${eq.membros_suspensos} suspensos` : ''}
                        {eq.convites_abertos > 0 ? ` · ${eq.convites_abertos} convites abertos` : ''}
                      </p>
                    </div>
                  </div>
                  {eq.isolamento_estrito && (
                    <Badge variant="yellow">
                      <Lock className="mr-1 inline h-3 w-3" /> isolamento estrito
                    </Badge>
                  )}
                </div>

                {/* membros */}
                {ms.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-silver-50 text-left text-[11px] uppercase tracking-wider text-silver-500">
                        <tr>
                          <th className="px-5 py-2">Membro</th>
                          <th className="px-5 py-2">Papel</th>
                          <th className="px-5 py-2">Status</th>
                          <th className="px-5 py-2">Aceito em</th>
                          <th className="px-5 py-2 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ms.map((m) => {
                          const suspenso = isSuspenso(m.permissoes)
                          return (
                            <tr key={m.id} className="border-t border-silver-100">
                              <td className="px-5 py-2">
                                <p className="font-medium text-navy">{m.nome_completo ?? '—'}</p>
                                <p className="font-mono text-xs text-silver-500">{m.email ?? '—'}</p>
                              </td>
                              <td className="px-5 py-2">
                                <Badge variant={m.papel_equipe === 'admin_equipe' ? 'green' : 'gray'}>
                                  {m.papel_equipe}
                                </Badge>
                              </td>
                              <td className="px-5 py-2">
                                {suspenso ? (
                                  <Badge variant="red"><ShieldOff className="mr-1 inline h-3 w-3" /> suspenso</Badge>
                                ) : (
                                  <Badge variant="green"><CheckCircle2 className="mr-1 inline h-3 w-3" /> ativo</Badge>
                                )}
                              </td>
                              <td className="px-5 py-2 text-xs text-silver-600">{fmtDate(m.aceito_em)}</td>
                              <td className="px-5 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    className="rounded border border-silver-200 px-2 py-1 text-xs text-navy hover:bg-silver-50 disabled:opacity-50"
                                    title={suspenso ? 'Reativar' : 'Suspender'}
                                    disabled={suspendMembro.isPending}
                                    onClick={() => suspendMembro.mutate({
                                      equipe_id: m.equipe_id,
                                      usuario_id: m.usuario_id,
                                      suspenso: !suspenso,
                                    })}
                                  >
                                    {suspenso
                                      ? <><Unlock className="mr-1 inline h-3 w-3" /> Reativar</>
                                      : <><Lock className="mr-1 inline h-3 w-3" /> Suspender</>}
                                  </button>
                                  <button
                                    className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/5 disabled:opacity-50"
                                    title="Remover da equipe"
                                    disabled={removeMembro.isPending}
                                    onClick={() => setConfirmRemove({
                                      equipe_id: m.equipe_id,
                                      usuario_id: m.usuario_id,
                                      nome: m.nome_completo ?? m.email ?? 'este membro',
                                    })}
                                  >
                                    <UserMinus className="mr-1 inline h-3 w-3" /> Remover
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* convites pendentes */}
                {cs.length > 0 && (
                  <div className="border-t border-silver-100 bg-gold-50/30 px-5 py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gold-700">
                      <Mail className="mr-1 inline h-3 w-3" /> Convites pendentes ({cs.length})
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {cs.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-3 rounded border border-gold-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy">{c.nome ?? c.email ?? '—'}</p>
                            <p className="truncate font-mono text-xs text-silver-500">{c.email ?? '—'}</p>
                            <p className="text-[11px] text-silver-500">
                              <Clock className="mr-1 inline h-3 w-3" />
                              expira em {fmtDate(c.expires_at)} · papel: {c.papel_equipe ?? '—'}
                            </p>
                          </div>
                          <button
                            className="shrink-0 rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/5 disabled:opacity-50"
                            disabled={revokeConvite.isPending}
                            onClick={() => revokeConvite.mutate(c.id)}
                          >
                            <MailX className="mr-1 inline h-3 w-3" /> Revogar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ms.length === 0 && cs.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-silver-500">
                    Equipe sem membros e sem convites pendentes.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* erro global das mutations */}
      {(suspendMembro.error || removeMembro.error || revokeConvite.error) && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-danger bg-danger/10 px-4 py-3 text-sm text-danger shadow">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          {((suspendMembro.error || removeMembro.error || revokeConvite.error) as Error).message}
        </div>
      )}

      {/* modal confirma remover */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-navy">Remover membro</h3>
            <p className="mb-4 text-sm text-silver-600">
              Tem certeza que deseja remover <strong>{confirmRemove.nome}</strong> da equipe? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-md border border-danger bg-danger px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={removeMembro.isPending}
                onClick={() => removeMembro.mutate({
                  equipe_id: confirmRemove.equipe_id,
                  usuario_id: confirmRemove.usuario_id,
                })}
              >
                {removeMembro.isPending ? 'Removendo...' : 'Confirmar'}
              </button>
              <button
                className="flex-1 rounded-md border border-silver-300 px-3 py-2 text-sm text-silver-700 hover:bg-silver-50"
                onClick={() => setConfirmRemove(null)}
                disabled={removeMembro.isPending}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* sentinel ícones não usados → tree shake */}
    </>
  )
}

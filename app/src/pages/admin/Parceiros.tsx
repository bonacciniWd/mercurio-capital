import { useMemo, useState, useEffect, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, Lock, Unlock, Plus, Loader2, AlertCircle, X,
  Mail, Copy, CheckCircle2, MailPlus, Phone, MapPin, Wallet, Pencil,
} from 'lucide-react'
import { brl, formatNumber } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import { maskCpf, onlyDigits } from '@/lib/documentoBr'

type PartnerStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

type PartnerRow = {
  partner_id: string
  usuario_id: string
  status: PartnerStatus
  cpf: string | null
  comissao_percentual: number
  endereco_cidade: string | null
  endereco_estado: string | null
  created_at: string
  aprovado_em: string | null
  motivo_rejeicao: string | null
  nome: string
  email: string
  telefone: string | null
  telefone_ddi: string | null
  ultimo_login_at: string | null
  usuario_ativo: boolean
  saldo_centavos: number
  wallet_bloqueada: boolean
  docs_count: number
  equipes_count: number
  membros_count: number
  propostas_total: number
  propostas_ativas: number
  volume_solicitado: number
  volume_aprovado: number
}

type InviteRow = {
  id: string
  email: string
  nome_completo: string
  telefone: string | null
  telefone_ddi: string | null
  observacoes: string | null
  status: 'sent' | 'accepted' | 'revoked' | 'expired'
  partner_id: string | null
  usuario_id: string | null
  created_at: string
  accepted_at: string | null
  revoked_at: string | null
  criado_por_nome: string | null
  partner_status: PartnerStatus | null
}

const STATUS_VARIANT: Record<PartnerStatus, 'green' | 'red' | 'yellow' | 'gray'> = {
  approved: 'green',
  pending: 'yellow',
  rejected: 'red',
  suspended: 'red',
}

const STATUS_LABEL: Record<PartnerStatus, string> = {
  approved: 'Ativo',
  pending: 'Pendente',
  rejected: 'Recusado',
  suspended: 'Suspenso',
}

const STATUS_FILTERS: Array<{ value: PartnerStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'approved', label: 'Ativos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'suspended', label: 'Suspensos' },
  { value: 'rejected', label: 'Recusados' },
]

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

// volume vem em reais (numeric do banco) — multiplicamos por 100 p/ usar brl(cents)
const volToBrl = (reais: number | null | undefined) => brl(Math.round((reais ?? 0) * 100))

const _legacyDemo: unknown[] = []
void _legacyDemo

export function AdminParceiros() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkPartnerId = searchParams.get('partner_id')
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | 'all'>('all')
  const [activeId, setActiveId] = useState<string | null>(deepLinkPartnerId)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [suspendMode, setSuspendMode] = useState(false)
  const [suspendMotivo, setSuspendMotivo] = useState('')
  const [showInvites, setShowInvites] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (deepLinkPartnerId) {
      const next = new URLSearchParams(searchParams)
      next.delete('partner_id')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const partners = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async (): Promise<PartnerRow[]> => {
      const { data, error } = await supabase
        .from('v_admin_partners')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      return (data ?? []) as PartnerRow[]
    },
  })

  const invites = useQuery({
    queryKey: ['admin', 'partner_invites'],
    enabled: showInvites,
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await supabase
        .from('v_admin_partner_invites')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(error.message)
      return (data ?? []) as InviteRow[]
    },
  })

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return (partners.data ?? []).filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!term) return true
      return [p.nome, p.email, p.cpf ?? '', p.endereco_cidade ?? '']
        .some((v) => v.toLowerCase().includes(term))
    })
  }, [partners.data, filter, statusFilter])

  const active = filtered.find((p) => p.partner_id === activeId) ?? null

  const suspend = useMutation({
    mutationFn: async (vars: { partner_id: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_suspend_partner', {
        p_partner_id: vars.partner_id,
        p_motivo: vars.motivo,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setSuspendMode(false)
      setSuspendMotivo('')
      void qc.invalidateQueries({ queryKey: ['admin', 'partners'] })
    },
  })

  const reactivate = useMutation({
    mutationFn: async (partnerId: string) => {
      const { error } = await supabase.rpc('admin_reactivate_partner', { p_partner_id: partnerId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'partners'] })
    },
  })

  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.rpc('admin_revoke_partner_invite', { p_invite_id: inviteId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'partner_invites'] })
    },
  })

  const resendInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.functions.invoke('admin-partner-invite-resend', {
        body: { invite_id: inviteId },
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'partner_invites'] })
    },
  })

  const kpis = useMemo(() => {
    const list = partners.data ?? []
    const ativos = list.filter((p) => p.status === 'approved').length
    const pendentes = list.filter((p) => p.status === 'pending').length
    const suspensos = list.filter((p) => p.status === 'suspended').length
    const volume = list.reduce((acc, p) => acc + Number(p.volume_solicitado ?? 0), 0)
    return { ativos, pendentes, suspensos, volume }
  }, [partners.data])

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Parceiros</h1>
          <p className="text-sm text-silver-600">Gestão completa da rede de originação.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInvites((v) => !v)}
            className="rounded-md border border-silver-300 px-3 py-2 text-sm text-silver-700 hover:bg-silver-50"
          >
            <Mail className="mr-1 inline h-4 w-4" />
            {showInvites ? 'Ocultar convites' : 'Ver convites'}
          </button>
          <button className="btn-gold" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> Convidar parceiro
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Parceiros ativos" value={formatNumber(kpis.ativos)} intent="success" />
        <KPICard label="Pendentes" value={formatNumber(kpis.pendentes)} intent="warning" />
        <KPICard label="Suspensos" value={formatNumber(kpis.suspensos)} intent="danger" />
        <KPICard label="Volume solicitado total" value={volToBrl(kpis.volume)} intent="gold" />
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input pl-9"
            placeholder="Buscar por nome, e-mail, CPF ou cidade"
          />
        </div>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PartnerStatus | 'all')}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>Status: {f.label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <div className="card overflow-x-auto">
          {partners.isLoading ? (
            <div className="flex items-center justify-center p-12 text-silver-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : partners.error ? (
            <div className="flex items-start gap-2 p-6 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {(partners.error as Error).message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-silver-500">
              Nenhum parceiro encontrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr>
                  <th className="px-4 py-3">Parceiro</th>
                  <th className="px-4 py-3 text-right">Equipe</th>
                  <th className="px-4 py-3 text-right">Propostas</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Desde</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.partner_id}
                    onClick={() => { setActiveId(p.partner_id); setSuspendMode(false) }}
                    className={`cursor-pointer border-t border-silver-100 ${
                      active?.partner_id === p.partner_id ? 'bg-gold/5' : 'hover:bg-silver-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-silver-900">{p.nome}</p>
                      <p className="text-xs text-silver-500">
                        {p.email}
                        {p.endereco_cidade && <> · {p.endereco_cidade}/{p.endereco_estado}</>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">{p.membros_count}</td>
                    <td className="px-4 py-3 text-right font-medium">{p.propostas_ativas}</td>
                    <td className="px-4 py-3 text-right font-bold text-navy">{volToBrl(p.volume_solicitado)}</td>
                    <td
                      className={`px-4 py-3 text-right ${
                        p.saldo_centavos < 2000 ? 'font-semibold text-danger' : 'text-silver-700'
                      }`}
                    >
                      {brl(Number(p.saldo_centavos ?? 0))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-silver-600">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="card h-fit p-5">
          {!active ? (
            <p className="text-sm text-silver-500">Selecione um parceiro para ver detalhes.</p>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-navy">{active.nome}</h3>
                  <p className="text-xs text-silver-500">{active.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[active.status]}>{STATUS_LABEL[active.status]}</Badge>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="rounded-md p-1.5 text-silver-500 hover:bg-silver-100 hover:text-navy"
                    title="Editar parceiro"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <dl className="mt-4 space-y-2 text-xs text-silver-700">
                {active.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-silver-400" />
                    +{active.telefone_ddi ?? '55'} {active.telefone}
                  </div>
                )}
                {active.endereco_cidade && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-silver-400" />
                    {active.endereco_cidade}/{active.endereco_estado}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5 text-silver-400" />
                  Saldo: <strong>{brl(Number(active.saldo_centavos ?? 0))}</strong>
                  {active.wallet_bloqueada && <span className="text-danger">(bloqueada)</span>}
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md bg-silver-50 p-3">
                  <p className="text-silver-500">Propostas</p>
                  <p className="text-base font-bold text-navy">{active.propostas_total}</p>
                  <p className="text-silver-500">ativas: {active.propostas_ativas}</p>
                </div>
                <div className="rounded-md bg-silver-50 p-3">
                  <p className="text-silver-500">Volume solicitado</p>
                  <p className="text-base font-bold text-navy">{volToBrl(active.volume_solicitado)}</p>
                  <p className="text-silver-500">aprovado: {volToBrl(active.volume_aprovado)}</p>
                </div>
                <div className="rounded-md bg-silver-50 p-3">
                  <p className="text-silver-500">Equipes</p>
                  <p className="text-base font-bold text-navy">{active.equipes_count}</p>
                  <p className="text-silver-500">{active.membros_count} membros</p>
                  <Link
                    to={`/admin/parceiros/${active.partner_id}/equipes`}
                    className="mt-1 inline-block text-[11px] font-semibold text-red-600 hover:underline"
                  >
                    Gerenciar →
                  </Link>
                </div>
                <div className="rounded-md bg-silver-50 p-3">
                  <p className="text-silver-500">Comissão</p>
                  <p className="text-base font-bold text-navy">
                    {Number(active.comissao_percentual ?? 0).toFixed(2)}%
                  </p>
                  <p className="text-silver-500">{active.docs_count} docs</p>
                </div>
              </div>

              <div className="mt-4 space-y-1 text-xs text-silver-600">
                <p>Cadastro: {fmtDate(active.created_at)}</p>
                {active.aprovado_em && <p>Aprovado em: {fmtDate(active.aprovado_em)}</p>}
                <p>Último login: {fmtDate(active.ultimo_login_at)}</p>
                {active.motivo_rejeicao && (
                  <p className="rounded-md border border-danger/20 bg-danger/5 px-2 py-1 text-danger">
                    Motivo: {active.motivo_rejeicao}
                  </p>
                )}
              </div>

              {active.status === 'approved' && !suspendMode && (
                <button
                  className="mt-5 w-full rounded-md border border-danger px-3 py-2 text-sm text-danger hover:bg-danger/5"
                  onClick={() => setSuspendMode(true)}
                >
                  <Lock className="mr-1 inline h-4 w-4" /> Suspender parceiro
                </button>
              )}

              {active.status === 'approved' && suspendMode && (
                <div className="mt-5 space-y-2">
                  <label className="label">Motivo da suspensão</label>
                  <textarea
                    className="input min-h-[70px]"
                    placeholder="Descreva o motivo"
                    value={suspendMotivo}
                    onChange={(e) => setSuspendMotivo(e.target.value)}
                  />
                  {suspend.error && (
                    <p className="text-xs text-danger">{(suspend.error as Error).message}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-md border border-danger bg-danger px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={suspend.isPending || suspendMotivo.trim().length < 3}
                      onClick={() => suspend.mutate({ partner_id: active.partner_id, motivo: suspendMotivo })}
                    >
                      {suspend.isPending ? 'Suspendendo...' : 'Confirmar'}
                    </button>
                    <button
                      className="flex-1 rounded-md border border-silver-300 px-3 py-2 text-sm text-silver-700 hover:bg-silver-50"
                      onClick={() => { setSuspendMode(false); setSuspendMotivo('') }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {(active.status === 'suspended' || active.status === 'rejected') && (
                <button
                  className="mt-5 w-full rounded-md border border-success bg-success/10 px-3 py-2 text-sm text-success hover:bg-success/15 disabled:opacity-50"
                  disabled={reactivate.isPending}
                  onClick={() => reactivate.mutate(active.partner_id)}
                >
                  {reactivate.isPending ? (
                    <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                  ) : (
                    <Unlock className="mr-1 inline h-4 w-4" />
                  )}
                  Reativar parceiro
                </button>
              )}

              {active.status === 'pending' && (
                <Link
                  to={`/admin/aprovacoes?partner_id=${active.partner_id}`}
                  className="mt-5 block rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-center text-xs text-warning hover:bg-warning/10"
                >
                  Em análise — abrir em Aprovações →
                </Link>
              )}

              {reactivate.error && (
                <p className="mt-2 text-xs text-danger">{(reactivate.error as Error).message}</p>
              )}
            </>
          )}
        </aside>
      </div>

      {showInvites && (
        <div className="card mt-6 overflow-x-auto">
          <header className="flex items-center justify-between px-4 py-3">
            <h3 className="font-semibold text-navy">
              <MailPlus className="mr-2 inline h-4 w-4" />
              Convites enviados
            </h3>
            {invites.isFetching && <Loader2 className="h-4 w-4 animate-spin text-silver-400" />}
          </header>
          {invites.error ? (
            <p className="px-4 py-6 text-sm text-danger">{(invites.error as Error).message}</p>
          ) : (invites.data ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-silver-500">Nenhum convite registrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr>
                  <th className="px-4 py-3">Convidado</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Enviado por</th>
                  <th className="px-4 py-3">Em</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(invites.data ?? []).map((i) => (
                  <tr key={i.id} className="border-t border-silver-100">
                    <td className="px-4 py-3">{i.nome_completo}</td>
                    <td className="px-4 py-3 text-silver-700">{i.email}</td>
                    <td className="px-4 py-3 text-silver-600">{i.criado_por_nome ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-silver-600">{fmtDate(i.created_at)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          i.status === 'accepted' ? 'green'
                            : i.status === 'sent' ? 'yellow'
                              : i.status === 'revoked' ? 'red' : 'gray'
                        }
                      >
                        {i.status === 'sent' ? 'Enviado'
                          : i.status === 'accepted' ? 'Aceito'
                            : i.status === 'revoked' ? 'Revogado' : 'Expirado'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.status === 'sent' && (
                        <div className="flex justify-end gap-3">
                          <button
                            className="text-xs text-silver-600 hover:underline"
                            disabled={resendInvite.isPending}
                            onClick={() => resendInvite.mutate(i.id)}
                          >
                            Reenviar
                          </button>
                          <button
                            className="text-xs text-danger hover:underline"
                            onClick={() => revokeInvite.mutate(i.id)}
                          >
                            Revogar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {inviteOpen && (
        <InviteDialog
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ['admin', 'partners'] })
            void qc.invalidateQueries({ queryKey: ['admin', 'partner_invites'] })
            void qc.invalidateQueries({ queryKey: ['admin', 'aprovacoes'] })
          }}
        />
      )}

      {editOpen && active && (
        <EditPartnerDialog
          partnerId={active.partner_id}
          currentEmail={active.email}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ['admin', 'partners'] })
            setEditOpen(false)
          }}
        />
      )}
    </>
  )
}

function InviteDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefoneDdi, setTelefoneDdi] = useState('55')
  const [telefone, setTelefone] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [resp, setResp] = useState<{ action_link?: string | null; email_sent?: boolean; fallback_reason?: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-invite-partner', {
        body: {
          email,
          nome_completo: nome,
          telefone: telefone || null,
          telefone_ddi: telefoneDdi || '55',
          observacoes: observacoes || null,
        },
      })
      if (error) throw new Error(error.message)
      return data as { action_link?: string | null; email_sent?: boolean; fallback_reason?: string | null }
    },
    onSuccess: (data) => {
      setResp(data)
      onSuccess()
    },
  })

  async function copyLink() {
    if (!resp?.action_link) return
    await navigator.clipboard.writeText(resp.action_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy">Convidar parceiro</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-silver-100">
            <X className="h-4 w-4 text-silver-500" />
          </button>
        </div>

        {!resp ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              invite.mutate()
            }}
          >
            <div>
              <label className="label">Nome completo *</label>
              <input
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                minLength={3}
                placeholder="Ex.: João da Silva"
              />
            </div>
            <div>
              <label className="label">E-mail *</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="parceiro@empresa.com"
              />
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <div>
                <label className="label">DDI</label>
                <input
                  className="input"
                  value={telefoneDdi}
                  onChange={(e) => setTelefoneDdi(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input
                  className="input"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea
                className="input min-h-[60px]"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Visível apenas internamente"
              />
            </div>

            {invite.error && (
              <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                {(invite.error as Error).message}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-silver-300 px-3 py-2 text-sm text-silver-700 hover:bg-silver-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={invite.isPending}
                className="btn-gold flex-1 disabled:opacity-50"
              >
                {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar convite
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Convite registrado para <strong>{email}</strong>.
                {resp.fallback_reason === 'rate_limit_smtp' && ' O envio automático de e-mail está temporariamente indisponível (rate-limit do Supabase). Use o link abaixo para finalizar.'}
                {resp.fallback_reason === 'usuario_ja_existe' && ' O usuário já existia — utilize o link abaixo para reenviar.'}
              </span>
            </div>
            {resp.action_link && (
              <div>
                <label className="label">Link de ativação</label>
                <div className="flex gap-2">
                  <input className="input flex-1 font-mono text-xs" readOnly value={resp.action_link} />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-md border border-silver-300 px-3 hover:bg-silver-50"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-silver-500">
                  Compartilhe com o parceiro caso o e-mail não chegue.
                </p>
              </div>
            )}
            <button onClick={onClose} className="btn-gold mt-2 w-full">Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// EditPartnerDialog — nome, CPF, telefone, endereço, e-mail de login, dados bancários
// ============================================================

type PartnerDetail = {
  cpf: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  dados_bancarios: {
    banco?: string
    agencia?: string
    conta?: string
    tipo?: string
    titular?: string
  } | null
}

type UsuarioDetail = {
  nome_completo: string
  email: string
  telefone: string | null
  telefone_ddi: string | null
}

function formatPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function formatCep(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8)
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`
}

type EditForm = {
  nome: string
  email: string
  telefone: string
  cpf: string
  endereco_cep: string
  endereco_logradouro: string
  endereco_numero: string
  endereco_complemento: string
  endereco_bairro: string
  endereco_cidade: string
  endereco_estado: string
  banco: string
  agencia: string
  conta: string
  tipo_conta: string
  titular: string
}

function emptyEditForm(): EditForm {
  return {
    nome: '', email: '', telefone: '', cpf: '',
    endereco_cep: '', endereco_logradouro: '', endereco_numero: '', endereco_complemento: '',
    endereco_bairro: '', endereco_cidade: '', endereco_estado: '',
    banco: '', agencia: '', conta: '', tipo_conta: '', titular: '',
  }
}

function EditPartnerDialog({
  partnerId,
  currentEmail,
  onClose,
  onSuccess,
}: {
  partnerId: string
  currentEmail: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<EditForm>(emptyEditForm)
  const [error, setError] = useState<string | null>(null)

  const detail = useQuery({
    queryKey: ['admin', 'partner-detail', partnerId],
    queryFn: async () => {
      const partnerRes = await supabase
        .from('partners')
        .select('cpf, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, dados_bancarios, usuario_id')
        .eq('id', partnerId)
        .single()
      if (partnerRes.error) throw new Error(partnerRes.error.message)

      const usuarioRes = await supabase
        .from('usuarios')
        .select('nome_completo, email, telefone, telefone_ddi')
        .eq('id', partnerRes.data.usuario_id)
        .single()
      if (usuarioRes.error) throw new Error(usuarioRes.error.message)

      return { partner: partnerRes.data as PartnerDetail, usuario: usuarioRes.data as UsuarioDetail }
    },
  })

  useEffect(() => {
    if (!detail.data) return
    const { partner, usuario } = detail.data
    const banco = partner.dados_bancarios ?? {}
    setForm({
      nome: usuario.nome_completo ?? '',
      email: usuario.email ?? '',
      telefone: formatPhone(usuario.telefone ?? ''),
      cpf: maskCpf(partner.cpf ?? ''),
      endereco_cep: formatCep(partner.endereco_cep ?? ''),
      endereco_logradouro: partner.endereco_logradouro ?? '',
      endereco_numero: partner.endereco_numero ?? '',
      endereco_complemento: partner.endereco_complemento ?? '',
      endereco_bairro: partner.endereco_bairro ?? '',
      endereco_cidade: partner.endereco_cidade ?? '',
      endereco_estado: partner.endereco_estado ?? '',
      banco: banco.banco ?? '',
      agencia: banco.agencia ?? '',
      conta: banco.conta ?? '',
      tipo_conta: banco.tipo ?? '',
      titular: banco.titular ?? '',
    })
  }, [detail.data])

  const save = useMutation({
    mutationFn: async () => {
      const emailChanged = form.email.trim().toLowerCase() !== currentEmail.trim().toLowerCase()
      if (emailChanged) {
        const { error: emailErr } = await supabase.functions.invoke('admin-partner-update-email', {
          body: { partner_id: partnerId, new_email: form.email.trim() },
        })
        if (emailErr) throw new Error(emailErr.message)
      }

      const { error: perfilErr } = await supabase.rpc('admin_partner_update_perfil', {
        p_partner_id: partnerId,
        p_payload: {
          nome: form.nome,
          telefone: onlyDigits(form.telefone),
          endereco_cep: onlyDigits(form.endereco_cep),
          endereco_logradouro: form.endereco_logradouro,
          endereco_numero: form.endereco_numero,
          endereco_complemento: form.endereco_complemento,
          endereco_bairro: form.endereco_bairro,
          endereco_cidade: form.endereco_cidade,
          endereco_estado: form.endereco_estado.toUpperCase().slice(0, 2),
          ...(onlyDigits(form.cpf) ? { cpf: onlyDigits(form.cpf) } : {}),
          dados_bancarios: {
            banco: form.banco,
            agencia: form.agencia,
            conta: form.conta,
            tipo: form.tipo_conta,
            titular: form.titular,
          },
        },
      })
      if (perfilErr) throw new Error(perfilErr.message)
    },
    onSuccess: () => onSuccess(),
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Falha ao salvar.'),
  })

  function bind<K extends keyof EditForm>(key: K, formatter?: (s: string) => string) {
    return {
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        const v = formatter ? formatter(e.target.value) : e.target.value
        setForm((f) => ({ ...f, [key]: v }))
      },
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy">Editar parceiro</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-silver-100">
            <X className="h-4 w-4 text-silver-500" />
          </button>
        </div>

        {detail.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-silver-400" />
          </div>
        ) : detail.error ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {(detail.error as Error).message}
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              save.mutate()
            }}
          >
            <div>
              <label className="label">Nome completo</label>
              <input className="input" {...bind('nome')} required minLength={3} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">CPF</label>
                <input className="input" placeholder="000.000.000-00" {...bind('cpf', maskCpf)} />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input className="input" placeholder="(11) 99999-9999" {...bind('telefone', formatPhone)} />
              </div>
            </div>

            <div>
              <label className="label">E-mail de login</label>
              <input className="input" type="email" {...bind('email')} required />
              <p className="mt-1 text-xs text-silver-500">
                Alterar o e-mail atualiza também o acesso do parceiro (auditado).
              </p>
            </div>

            <fieldset className="rounded-md border border-silver-200 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-silver-500">Endereço</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">CEP</label>
                  <input className="input" placeholder="00000-000" {...bind('endereco_cep', formatCep)} />
                </div>
                <Field label="Cidade" {...bind('endereco_cidade')} />
                <Field label="Logradouro" {...bind('endereco_logradouro')} />
                <Field label="Número" {...bind('endereco_numero')} />
                <Field label="Complemento" {...bind('endereco_complemento')} />
                <Field label="Bairro" {...bind('endereco_bairro')} />
                <Field label="Estado (UF)" maxLength={2} {...bind('endereco_estado')} />
              </div>
            </fieldset>

            <fieldset className="rounded-md border border-silver-200 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-silver-500">Dados bancários</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Banco" {...bind('banco')} />
                <Field label="Agência" {...bind('agencia')} />
                <Field label="Conta" {...bind('conta')} />
                <Field label="Tipo de conta" placeholder="corrente/poupança" {...bind('tipo_conta')} />
                <Field label="Titular" {...bind('titular')} />
              </div>
            </fieldset>

            {error && (
              <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-silver-300 px-3 py-2 text-sm text-silver-700 hover:bg-silver-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="btn-gold flex-1 disabled:opacity-50"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" {...props} />
    </div>
  )
}



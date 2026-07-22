import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, Lock, Unlock, Plus, Loader2, AlertCircle, X,
  Mail, Copy, CheckCircle2, MailPlus, Phone, MapPin, Wallet,
} from 'lucide-react'
import { brl, formatNumber } from '@/lib/utils'
import { KPICard } from '@/components/KPICard'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

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
                <Badge variant={STATUS_VARIANT[active.status]}>{STATUS_LABEL[active.status]}</Badge>
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
                        <button
                          className="text-xs text-danger hover:underline"
                          onClick={() => revokeInvite.mutate(i.id)}
                        >
                          Revogar
                        </button>
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



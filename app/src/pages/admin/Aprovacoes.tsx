import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Eye, Check, X, FileText, Loader2, ExternalLink, AlertCircle,
  Phone, MapPin, UserPlus, UserCheck, Info,
} from 'lucide-react'
import { StatusBadge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

type AprovacaoRow = {
  partner_id: string
  usuario_id: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  cpf: string | null
  nome: string
  email: string
  telefone: string | null
  telefone_ddi: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  ultimo_login_at: string | null
  created_at: string
  aprovado_em: string | null
  motivo_rejeicao: string | null
  docs_count: number
  origem: 'convite' | 'auto_cadastro'
  invite_observacoes: string | null
  invite_criado_por_nome: string | null
  invite_created_at: string | null
  invite_status: 'sent' | 'accepted' | 'revoked' | 'expired' | null
}

type DocRow = {
  id: string
  tipo: string
  storage_path: string
  mime_type: string | null
  tamanho_bytes: number | null
  validado: boolean
  created_at: string
}

const STATUS_FILTERS: { value: AprovacaoRow['status'] | 'all'; label: string }[] = [
  { value: 'pending',   label: 'Pendentes' },
  { value: 'approved',  label: 'Aprovados' },
  { value: 'rejected',  label: 'Recusados' },
  { value: 'suspended', label: 'Suspensos' },
  { value: 'all',       label: 'Todos' },
]

function statusLabel(s: AprovacaoRow['status']) {
  return { pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado', suspended: 'Suspenso' }[s]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function AdminAprovacoes() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkPartnerId = searchParams.get('partner_id')
  const [statusFilter, setStatusFilter] = useState<AprovacaoRow['status'] | 'all'>(
    deepLinkPartnerId ? 'all' : 'pending',
  )
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(deepLinkPartnerId)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectMotivo, setRejectMotivo] = useState('')

  // Limpa o parâmetro de deep-link após consumir, para não interferir nos filtros futuros.
  useEffect(() => {
    if (deepLinkPartnerId) {
      const next = new URLSearchParams(searchParams)
      next.delete('partner_id')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const aprovacoes = useQuery({
    queryKey: ['admin', 'aprovacoes', statusFilter],
    queryFn: async (): Promise<AprovacaoRow[]> => {
      let query = supabase
        .from('v_admin_partner_aprovacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []) as AprovacaoRow[]
    },
  })

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return aprovacoes.data ?? []
    return (aprovacoes.data ?? []).filter((r) =>
      [r.nome, r.email, r.cpf ?? ''].some((v) => v.toLowerCase().includes(term)),
    )
  }, [aprovacoes.data, search])

  const active = filteredRows.find((r) => r.partner_id === activeId) ?? filteredRows[0]
  const activePartnerId = active?.partner_id

  const docs = useQuery({
    queryKey: ['admin', 'aprovacoes', 'docs', activePartnerId],
    enabled: Boolean(activePartnerId),
    queryFn: async (): Promise<DocRow[]> => {
      const { data, error } = await supabase
        .from('partner_documentos')
        .select('id, tipo, storage_path, mime_type, tamanho_bytes, validado, created_at')
        .eq('partner_id', activePartnerId!)
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })

  const approve = useMutation({
    mutationFn: async (partnerId: string) => {
      const { error } = await supabase.rpc('admin_approve_partner', { p_partner_id: partnerId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'aprovacoes'] })
    },
  })

  const reject = useMutation({
    mutationFn: async ({ partnerId, motivo }: { partnerId: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_reject_partner', {
        p_partner_id: partnerId,
        p_motivo: motivo,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setRejectMode(false)
      setRejectMotivo('')
      void qc.invalidateQueries({ queryKey: ['admin', 'aprovacoes'] })
    },
  })

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage
      .from('partner_docs')
      .createSignedUrl(path, 60 * 5)
    if (error || !data) {
      alert(error?.message ?? 'Falha ao gerar link.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const pendingCount = (aprovacoes.data ?? []).filter((r) => r.status === 'pending').length

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Aprovações de parceiros</h1>
          <p className="text-sm text-silver-600">Revise documentação e libere o acesso ao painel.</p>
        </div>
        {statusFilter === 'pending' && (
          <span className="badge bg-warning/15 text-warning">{pendingCount} pendentes</span>
        )}
      </div>

      <div className="card mb-4 flex gap-3 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nome, e-mail ou CPF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AprovacaoRow['status'] | 'all')}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <div className="card overflow-hidden">
          {aprovacoes.isLoading ? (
            <div className="flex items-center justify-center p-12 text-silver-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : aprovacoes.error ? (
            <div className="flex items-start gap-2 p-6 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {(aprovacoes.error as Error).message}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-silver-500">
              Nenhum parceiro encontrado para os filtros atuais.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr>
                  <th className="px-4 py-3">Parceiro</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3">Docs</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={r.partner_id}
                    onClick={() => {
                      setActiveId(r.partner_id)
                      setRejectMode(false)
                    }}
                    className={`cursor-pointer border-t border-silver-100 ${
                      active?.partner_id === r.partner_id ? 'bg-gold/5' : 'hover:bg-silver-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-silver-900">{r.nome}</p>
                      <p className="text-xs text-silver-500">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-silver-700">{r.cpf ?? '—'}</td>
                    <td className="px-4 py-3 text-silver-700">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-silver-700">{r.docs_count}</td>
                    <td className="px-4 py-3"><StatusBadge status={statusLabel(r.status)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/admin/parceiros?partner_id=${r.partner_id}`) }}
                          className="rounded-md p-1.5 hover:bg-silver-100"
                          title="Ver perfil"
                        >
                          <Eye className="h-4 w-4 text-silver-600" />
                        </button>
                        {r.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); approve.mutate(r.partner_id) }}
                              className="rounded-md p-1.5 hover:bg-success/10"
                              title="Aprovar"
                            >
                              <Check className="h-4 w-4 text-success" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setActiveId(r.partner_id); setRejectMode(true) }}
                              className="rounded-md p-1.5 hover:bg-danger/10"
                              title="Recusar"
                            >
                              <X className="h-4 w-4 text-danger" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="card h-fit p-5">
          {active ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-navy">{active.nome}</h3>
                  <p className="truncate text-xs text-silver-500">{active.email}</p>
                </div>
                <StatusBadge status={statusLabel(active.status)} />
              </div>

              <dl className="space-y-1.5 text-xs text-silver-700">
                {active.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-silver-400" />
                    +{active.telefone_ddi ?? '55'} {active.telefone}
                  </div>
                )}
                {(active.endereco_cidade || active.endereco_estado) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-silver-400" />
                    {[active.endereco_cidade, active.endereco_estado].filter(Boolean).join('/')}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {active.origem === 'convite' ? (
                    <UserPlus className="h-3.5 w-3.5 text-gold" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5 text-silver-400" />
                  )}
                  {active.origem === 'convite'
                    ? <>Convidado{active.invite_criado_por_nome ? ` por ${active.invite_criado_por_nome}` : ''} em {active.invite_created_at ? fmtDate(active.invite_created_at) : '—'}</>
                    : <>Auto-cadastro · {fmtDate(active.created_at)}</>}
                </div>
                {active.ultimo_login_at && (
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-silver-400" />
                    Último login: {fmtDate(active.ultimo_login_at)}
                  </div>
                )}
              </dl>

              {active.invite_observacoes && (
                <div className="mt-3 rounded-md border border-silver-200 bg-silver-50 px-3 py-2 text-xs text-silver-700">
                  <p className="mb-0.5 font-semibold text-silver-800">Observações do convite</p>
                  {active.invite_observacoes}
                </div>
              )}

              <h4 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-silver-500">
                Documentos enviados ({active.docs_count})
              </h4>

              <div className="space-y-2">
                {docs.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-silver-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (docs.data ?? []).length === 0 ? (
                  <p className="rounded-md border border-dashed border-silver-200 p-3 text-center text-xs text-silver-500">
                    {active.origem === 'convite'
                      ? 'O parceiro ainda não acessou o painel para enviar documentos.'
                      : 'Nenhum documento enviado ainda.'}
                  </p>
                ) : (
                  (docs.data ?? []).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => openDoc(d.storage_path)}
                      className="btn-no-liquid flex w-full items-center gap-3 rounded-none border border-silver-200 p-3 text-left text-xs hover:border-red-600 hover:bg-gold/5"
                    >
                      <FileText className="h-5 w-5 text-red-400" />
                      <div className="flex-1">
                        <p className="font-bold text-black">{d.tipo}</p>
                        <p className="text-silver-500">
                          {d.mime_type ?? '—'} · {d.tamanho_bytes ? Math.round(d.tamanho_bytes / 1024) + ' KB' : ''}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-silver-400" />
                    </button>
                  ))
                )}
              </div>

              {active.status === 'rejected' && active.motivo_rejeicao && (
                <div className="mt-4 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">
                  <p className="font-semibold">Motivo da recusa</p>
                  <p>{active.motivo_rejeicao}</p>
                </div>
              )}

              {active.status === 'pending' && !rejectMode && (
                <div className="mt-5 flex gap-2">
                  <button
                    className="btn-gold flex-1 disabled:opacity-50"
                    onClick={() => approve.mutate(active.partner_id)}
                    disabled={approve.isPending}
                  >
                    {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Aprovar
                  </button>
                  <button
                    className="flex-1 rounded-md border border-danger px-3 py-2 text-sm text-danger hover:bg-danger/5"
                    onClick={() => setRejectMode(true)}
                  >
                    <X className="inline h-4 w-4" /> Recusar
                  </button>
                </div>
              )}

              {active.status === 'pending' && rejectMode && (
                <div className="mt-5 space-y-2">
                  <label className="label">Motivo da recusa</label>
                  <textarea
                    className="input min-h-[80px]"
                    placeholder="Descreva o motivo (será exibido ao parceiro)"
                    value={rejectMotivo}
                    onChange={(e) => setRejectMotivo(e.target.value)}
                  />
                  {reject.error && (
                    <p className="text-xs text-danger">{(reject.error as Error).message}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-md border border-danger bg-danger px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={reject.isPending || rejectMotivo.trim().length < 3}
                      onClick={() => reject.mutate({ partnerId: active.partner_id, motivo: rejectMotivo })}
                    >
                      {reject.isPending ? 'Enviando...' : 'Confirmar recusa'}
                    </button>
                    <button
                      className="flex-1 rounded-md border border-silver-300 px-3 py-2 text-sm text-silver-700 hover:bg-silver-50"
                      onClick={() => { setRejectMode(false); setRejectMotivo('') }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {approve.error && (
                <p className="mt-3 text-xs text-danger">{(approve.error as Error).message}</p>
              )}
            </>
          ) : (
            <>
              <h3 className="font-semibold text-navy">Detalhes do parceiro</h3>
              <p className="mt-2 text-sm text-silver-500">Selecione um parceiro à esquerda para revisar.</p>
            </>
          )}
        </aside>
      </div>
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, CalendarDays, Check, ChevronRight, Clock3,
  Download, Eye, FileText, Loader2, Mail, MapPin, Phone, Search, Send,
  ShieldCheck, UserCheck, UserPlus, X,
} from 'lucide-react'
import { StatusBadge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import './Aprovacoes.css'

type PartnerStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
type AprovacaoRow = {
  partner_id: string
  usuario_id: string
  status: PartnerStatus
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
  invite_id: string | null
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
type DocumentViewer = { document: DocRow; url: string | null; loading: boolean; error: string | null }

const STATUS_FILTERS: { value: PartnerStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Recusados' },
  { value: 'suspended', label: 'Suspensos' },
  { value: 'all', label: 'Todos' },
]
const statusNames: Record<PartnerStatus, string> = {
  pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado', suspended: 'Suspenso',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase()
}

function fileSize(bytes: number | null) {
  if (!bytes) return 'Tamanho indisponível'
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function isImage(document: DocRow) {
  const mime = document.mime_type?.toLowerCase()
  return mime ? ['image/jpeg', 'image/png', 'image/webp'].includes(mime) : /\.(jpe?g|png|webp)$/i.test(document.storage_path)
}

function isPdf(document: DocRow) {
  const mime = document.mime_type?.toLowerCase()
  return mime === 'application/pdf' || (!mime && /\.pdf$/i.test(document.storage_path))
}

function DocumentModal({
  viewer,
  onClose,
}: {
  viewer: DocumentViewer
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const canPreview = isPdf(viewer.document) || isImage(viewer.document)
  return (
    <div
      className="approval-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section className="approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-document-title">
        <header className="approval-modal__header">
          <span className="approval-file-icon"><FileText size={18} /></span>
          <div className="approval-modal__title">
            <strong id="approval-document-title">{viewer.document.tipo}</strong>
            <span>{viewer.document.mime_type ?? 'Tipo indisponível'} · {fileSize(viewer.document.tamanho_bytes)}</span>
          </div>
          <div className="approval-modal__actions">
            {viewer.url && (
              <a className="approval-icon-button" href={viewer.url} download aria-label="Baixar documento" title="Baixar documento">
                <Download size={17} />
              </a>
            )}
            <button className="btn-no-liquid approval-icon-button" type="button" onClick={onClose} aria-label="Fechar visualização">
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="approval-modal__body">
          <div className="approval-document-canvas">
            {viewer.loading ? (
              <div className="approval-viewer-state"><Loader2 className="approval-spin" size={25} /> Gerando acesso temporário…</div>
            ) : viewer.error ? (
              <div className="approval-viewer-state approval-viewer-state--error"><AlertCircle size={22} /> <span>{viewer.error}</span></div>
            ) : viewer.url && canPreview && isPdf(viewer.document) ? (
              <iframe className="approval-pdf" src={viewer.url} title={`Documento PDF: ${viewer.document.tipo}`} />
            ) : viewer.url && canPreview && isImage(viewer.document) ? (
              <img className="approval-image" src={viewer.url} alt={`Documento enviado: ${viewer.document.tipo}`} />
            ) : viewer.url ? (
              <div className="approval-viewer-state">
                <FileText size={28} />
                <span>Este formato não pode ser exibido aqui.</span>
                <a className="approval-download-link" href={viewer.url} download><Download size={15} /> Baixar arquivo</a>
              </div>
            ) : null}
          </div>
          <aside className="approval-modal-aside">
            <span className="approval-security-icon"><ShieldCheck size={19} /></span>
            <h3>Acesso restrito</h3>
            <p>O arquivo é carregado com a sessão administrativa e o link temporário expira em cinco minutos.</p>
            <div className="approval-security-note"><ShieldCheck size={15} /> Documento armazenado em área privada</div>
          </aside>
        </div>
      </section>
    </div>
  )
}

export function AdminAprovacoes() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkPartnerId = searchParams.get('partner_id')
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | 'all'>(deepLinkPartnerId ? 'all' : 'pending')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(deepLinkPartnerId)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectMotivo, setRejectMotivo] = useState('')
  const [viewer, setViewer] = useState<DocumentViewer | null>(null)

  useEffect(() => {
    if (deepLinkPartnerId) {
      const next = new URLSearchParams(searchParams)
      next.delete('partner_id')
      setSearchParams(next, { replace: true })
    }
    // Consume the initial deep-link only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const approvals = useQuery({
    queryKey: ['admin', 'aprovacoes', statusFilter],
    queryFn: async (): Promise<AprovacaoRow[]> => {
      let query = supabase.from('v_admin_partner_aprovacoes').select('*').order('created_at', { ascending: false }).limit(200)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []) as AprovacaoRow[]
    },
  })

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return (approvals.data ?? []).filter((row) => !term || [row.nome, row.email, row.cpf ?? ''].some((value) => value.toLocaleLowerCase('pt-BR').includes(term)))
  }, [approvals.data, search])
  const active = filteredRows.find((row) => row.partner_id === activeId) ?? filteredRows[0]
  const activePartnerId = active?.partner_id

  useEffect(() => {
    setViewer(null)
    setRejectMode(false)
    setRejectMotivo('')
  }, [activePartnerId])

  const docs = useQuery({
    queryKey: ['admin', 'aprovacoes', 'docs', activePartnerId],
    enabled: Boolean(activePartnerId),
    queryFn: async (): Promise<DocRow[]> => {
      const { data, error } = await supabase.from('partner_documentos')
        .select('id, tipo, storage_path, mime_type, tamanho_bytes, validado, created_at')
        .eq('partner_id', activePartnerId!).order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })

  const approve = useMutation({
    mutationFn: async (partnerId: string) => {
      const { error } = await supabase.rpc('admin_approve_partner', { p_partner_id: partnerId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'aprovacoes'] }) },
  })
  const reject = useMutation({
    mutationFn: async ({ partnerId, motivo }: { partnerId: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_reject_partner', { p_partner_id: partnerId, p_motivo: motivo })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setRejectMode(false)
      setRejectMotivo('')
      void qc.invalidateQueries({ queryKey: ['admin', 'aprovacoes'] })
    },
  })
  const resendInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.functions.invoke('admin-partner-invite-resend', { body: { invite_id: inviteId } })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'aprovacoes'] }) },
  })

  async function openDocument(document: DocRow) {
    setViewer({ document, url: null, loading: true, error: null })
    const { data, error } = await supabase.storage.from('partner_docs').createSignedUrl(document.storage_path, 60 * 5)
    if (error || !data?.signedUrl) {
      setViewer((current) => current?.document.id === document.id
        ? { ...current, loading: false, error: error?.message ?? 'Não foi possível abrir o documento.' }
        : current)
      return
    }
    setViewer((current) => current?.document.id === document.id
      ? { ...current, loading: false, url: data.signedUrl }
      : current)
  }

  const pendingCount = statusFilter === 'pending' ? (approvals.data ?? []).length : null

  return (
    <section className="admin-approvals" aria-labelledby="approvals-title">
      <header className="approvals-heading">
        <div>
          <span className="approvals-eyebrow">Gestão de cadastros</span>
          <h1 id="approvals-title">Aprovações de parceiros</h1>
          <p>Revise os dados e documentos enviados antes de liberar o acesso.</p>
        </div>
        {pendingCount !== null && <div className="approvals-summary"><span><Clock3 size={17} /></span><strong>{pendingCount}</strong><small>aguardando análise</small></div>}
      </header>

      <div className="approvals-toolbar" aria-label="Filtros de parceiros">
        <label className="approvals-search"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou CPF" aria-label="Buscar por nome, e-mail ou CPF" />{search && <button className="btn-no-liquid" type="button" onClick={() => setSearch('')} aria-label="Limpar busca"><X size={15} /></button>}</label>
        <div className="approvals-filters" role="group" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((filter) => <button className={`btn-no-liquid${statusFilter === filter.value ? ' is-active' : ''}`} key={filter.value} type="button" aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)}>{filter.label}</button>)}
        </div>
      </div>

      <div className="approvals-workspace">
        <section className="approvals-list-panel" aria-label="Solicitações de parceiros">
          <header className="approvals-panel-heading"><div><h2>Solicitações</h2><span>{filteredRows.length} {filteredRows.length === 1 ? 'resultado' : 'resultados'}</span></div><span className="approvals-columns" aria-hidden="true">Cadastro <i>Docs</i></span></header>
          {approvals.isLoading ? <div className="approvals-state"><Loader2 className="approval-spin" size={22} /> Carregando solicitações…</div>
            : approvals.error ? <div className="approvals-state approvals-state--error"><AlertCircle size={19} />{(approvals.error as Error).message}</div>
              : filteredRows.length === 0 ? <div className="approvals-state"><Search size={22} /><strong>Nenhum parceiro encontrado</strong><span>Tente buscar por outro nome, e-mail ou CPF.</span></div>
                : <div className="approvals-partner-list">{filteredRows.map((row) => <button className={`btn-no-liquid approvals-partner-row${active?.partner_id === row.partner_id ? ' is-selected' : ''}`} key={row.partner_id} type="button" aria-pressed={active?.partner_id === row.partner_id} onClick={() => { setActiveId(row.partner_id); setRejectMode(false) }}>
                  <span className="approvals-partner-avatar">{initials(row.nome)}</span><span className="approvals-partner-copy"><strong>{row.nome}</strong><small>{row.email}</small></span><span className="approvals-row-date">{formatDate(row.created_at)}</span><span className="approvals-doc-count">{row.docs_count}</span><ChevronRight className="approvals-row-chevron" size={16} />
                </button>)}</div>}
        </section>

        <aside className="approvals-review-panel" aria-label="Análise do parceiro selecionado">
          {active ? <>
            <header className="approvals-review-top">
              <span className="approvals-large-avatar">{initials(active.nome)}</span>
              <div className="approvals-review-identity"><StatusBadge status={statusNames[active.status]} /><h2>{active.nome}</h2><p><Mail size={13} />{active.email}</p></div>
              <button className="btn-no-liquid approvals-profile-button" type="button" onClick={() => navigate(`/admin/parceiros?partner_id=${active.partner_id}`)} title="Ver perfil do parceiro">Ver perfil</button>
            </header>

            <div className="approvals-partner-meta">
              <div><Phone size={16} /><span><small>Telefone</small><strong>{active.telefone ? `+${active.telefone_ddi ?? '55'} ${active.telefone}` : 'Não informado'}</strong></span></div>
              <div><CalendarDays size={16} /><span><small>Cadastro</small><strong>{formatDate(active.created_at)}</strong></span></div>
              <div>{active.origem === 'convite' ? <UserPlus size={16} /> : <UserCheck size={16} />}<span><small>Origem</small><strong>{active.origem === 'convite' ? 'Convite' : 'Auto-cadastro'}</strong></span></div>
              {(active.endereco_cidade || active.endereco_estado) && <div><MapPin size={16} /><span><small>Localização</small><strong>{[active.endereco_cidade, active.endereco_estado].filter(Boolean).join('/')}</strong></span></div>}
            </div>

            {active.invite_observacoes && <div className="approvals-invite-note"><strong>Observações do convite</strong><span>{active.invite_observacoes}</span></div>}
            {active.status === 'pending' && active.origem === 'convite' && active.invite_status === 'sent' && active.invite_id && <button className="btn-no-liquid approvals-resend" type="button" onClick={() => resendInvite.mutate(active.invite_id!)} disabled={resendInvite.isPending}>{resendInvite.isPending ? <Loader2 className="approval-spin" size={15} /> : <Send size={15} />} Reenviar convite</button>}
            {resendInvite.error && <p className="approvals-error-text">{(resendInvite.error as Error).message}</p>}
            {resendInvite.isSuccess && <p className="approvals-success-text">Convite reenviado com sucesso.</p>}

            <section className="approvals-documents">
              <header className="approvals-documents-heading"><div><h3>Documentos enviados</h3><span>{docs.data?.length ?? active.docs_count} arquivos</span></div><span className="approvals-secure-label"><ShieldCheck size={14} /> Acesso seguro</span></header>
              {docs.isLoading ? <div className="approvals-documents-state"><Loader2 className="approval-spin" size={18} /></div>
                : docs.error ? <p className="approvals-documents-empty approvals-documents-empty--error">{(docs.error as Error).message}</p>
                  : (docs.data ?? []).length === 0 ? <p className="approvals-documents-empty">{active.origem === 'convite' ? 'O parceiro ainda não acessou o painel para enviar documentos.' : 'Nenhum documento enviado ainda.'}</p>
                    : <div className="approvals-documents-list">{(docs.data ?? []).map((document) => <button className="btn-no-liquid approvals-document-row" key={document.id} type="button" onClick={() => void openDocument(document)}>
                      <span className="approval-file-icon"><FileText size={18} /></span><span className="approvals-document-copy"><strong>{document.tipo}</strong><small>{document.mime_type ?? 'Tipo não informado'} · {fileSize(document.tamanho_bytes)}</small></span><span className="approvals-view-document"><Eye size={15} /> Visualizar</span>
                    </button>)}</div>}
            </section>

            {active.status === 'rejected' && active.motivo_rejeicao && <div className="approvals-rejection-note"><strong>Motivo da recusa</strong><span>{active.motivo_rejeicao}</span></div>}

            {active.status === 'pending' && <footer className="approvals-decision-bar">
              {!rejectMode ? <><div className="approvals-decision-copy"><strong>Concluir análise</strong><span>A decisão será registrada no histórico.</span></div><div className="approvals-decision-actions"><button type="button" className="btn-no-liquid approval-button approval-button--secondary" onClick={() => setRejectMode(true)}><X size={16} /> Recusar</button><button type="button" className="btn-no-liquid approval-button approval-button--primary" onClick={() => approve.mutate(active.partner_id)} disabled={approve.isPending}>{approve.isPending ? <Loader2 className="approval-spin" size={16} /> : <Check size={16} />} Aprovar parceiro</button></div></>
                : <div className="approvals-reject-form"><label htmlFor="approval-reject-reason">Motivo da recusa</label><textarea id="approval-reject-reason" value={rejectMotivo} onChange={(event) => setRejectMotivo(event.target.value)} placeholder="Descreva o motivo (será exibido ao parceiro)" /><div className="approvals-decision-actions"><button type="button" className="btn-no-liquid approval-button approval-button--secondary" onClick={() => { setRejectMode(false); setRejectMotivo('') }}>Cancelar</button><button type="button" className="btn-no-liquid approval-button approval-button--danger" disabled={reject.isPending || rejectMotivo.trim().length < 3} onClick={() => reject.mutate({ partnerId: active.partner_id, motivo: rejectMotivo })}>{reject.isPending ? <Loader2 className="approval-spin" size={16} /> : <X size={16} />} Confirmar recusa</button></div>{reject.error && <p className="approvals-error-text">{(reject.error as Error).message}</p>}</div>}
              {approve.error && <p className="approvals-error-text">{(approve.error as Error).message}</p>}
            </footer>}
            {active.ultimo_login_at && <p className="approvals-last-login">Último acesso: {formatDate(active.ultimo_login_at)}</p>}
          </> : <div className="approvals-empty-review"><UserCheck size={26} /><strong>Selecione um parceiro</strong><span>Os dados da solicitação aparecerão aqui.</span></div>}
        </aside>
      </div>

      {viewer && <DocumentModal viewer={viewer} onClose={() => setViewer(null)} />}
    </section>
  )
}

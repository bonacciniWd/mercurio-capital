import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { SearchablePartnerSelect, type PartnerSelectOption } from '@/components/SearchablePartnerSelect'
import { ProspeccaoDetalheTabs, type ProspeccaoDetalheTab } from '@/components/ProspeccaoDetalheTabs'
import { ProspeccaoClienteAnexos } from '@/components/ProspeccaoClienteAnexos'
import { useProspeccaoClienteCreate, useProspeccaoClienteHistorico, useProspeccaoClienteUpdate } from '@/hooks/useProspeccoesClientes'
import { PROSPECCAO_CLIENTE_ORIGENS, PROSPECCAO_CLIENTE_ORIGEM_LABEL, PROSPECCAO_CLIENTE_STATUS_LABEL, prospeccaoClienteTelefoneDigits, prospeccaoClienteTelefoneDisplay, type ProspeccaoCliente, type ProspeccaoClienteOrigem } from '@/lib/prospeccaoCliente'

type Form = { nome_completo: string; email: string; telefone: string; partner_id: string; equipe_id: string; origem: ProspeccaoClienteOrigem | ''; notas: string }
function initialForm(prospect: ProspeccaoCliente | null, partnerId: string): Form {
  return { nome_completo: prospect?.nome_completo ?? '', email: prospect?.email ?? '', telefone: prospeccaoClienteTelefoneDisplay(prospect?.telefone ?? ''), partner_id: prospect?.partner_id ?? partnerId, equipe_id: prospect?.equipe_id ?? '', origem: prospect?.origem ?? 'outro', notas: prospect?.notas ?? '' }
}

export function ProspeccaoClienteDetalheModal({ prospect, admin, initialTab = 'dados', onClose }: {
  prospect: ProspeccaoCliente | null; admin: boolean; initialTab?: ProspeccaoDetalheTab; onClose: () => void
}) {
  const { session } = useAuth()
  const id = useId()
  const [tab, setTab] = useState(initialTab)
  const [form, setForm] = useState(() => initialForm(prospect, session?.partnerId ?? ''))
  const [base, setBase] = useState(form)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadDraft, setUploadDraft] = useState(false)
  const [closing, setClosing] = useState(false)
  const discardUploads = useRef<(() => Promise<void>) | null>(null)
  const create = useProspeccaoClienteCreate()
  const update = useProspeccaoClienteUpdate()
  const history = useProspeccaoClienteHistorico(prospect?.id ?? null)
  const readOnly = prospect?.status === 'proposta_criada'
  const pending = create.isPending || update.isPending || uploadBusy || closing
  const dirty = JSON.stringify(form) !== JSON.stringify(base)
  const panel = useRef<HTMLElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const close = useRef(() => {})
  const partners = useQuery({
    queryKey: ['prospeccao-clientes-partners'], enabled: admin,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_admin_partners').select('partner_id, nome, email, status').eq('status', 'approved').order('nome')
      if (error) throw error
      return (data ?? []) as PartnerSelectOption[]
    },
  })
  const teams = useQuery({
    queryKey: ['prospeccao-clientes-equipes', admin],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipes').select('id, partner_id, nome').order('nome')
      if (error) throw error
      return (data ?? []) as { id: string; partner_id: string; nome: string }[]
    },
  })
  const teamOptions = (teams.data ?? []).filter(team => team.partner_id === form.partner_id)
  function patch<K extends keyof Form>(key: K, value: Form[K]) { setForm(current => ({ ...current, [key]: value })); setSuccess(null); setDiscard(false) }
  close.current = () => { if (pending) return; if (dirty || uploadDraft) setDiscard(true); else onClose() }
  useEffect(() => {
    const opener = document.activeElement
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => closeButton.current?.focus(), 0)
    function keyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="file"]), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(element => !element.closest('[hidden]'))
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyDown)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', keyDown); document.body.style.overflow = previous; if (opener instanceof HTMLElement && opener.isConnected) opener.focus() }
  }, [])

  async function save(event: FormEvent) {
    event.preventDefault(); if (readOnly || pending) return
    setError(null); setSuccess(null)
    if (form.nome_completo.trim().length < 2) { setTab('dados'); setError('Informe o nome do prospect.'); return }
    const email = form.email.trim() || null
    const telefone = prospeccaoClienteTelefoneDigits(form.telefone) || null
    if ((!email && !telefone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setTab('dados'); setError('Informe um e-mail válido ou um telefone para contato.'); return }
    if (telefone && (telefone.length < 10 || telefone.length > 13)) { setTab('dados'); setError('Informe um telefone com DDD.'); return }
    if (admin && !form.partner_id) { setTab('dados'); setError('Selecione o parceiro responsável.'); return }
    const payload = { nome_completo: form.nome_completo.trim(), email, telefone, origem: form.origem || null, notas: form.notas.trim() || null, equipe_id: form.equipe_id || null }
    try {
      if (prospect) {
        await update.mutateAsync({ ...payload, id: prospect.id, equipe_id: session?.role === 'team_member' ? undefined : payload.equipe_id, limpar_equipe: session?.role !== 'team_member' && !form.equipe_id })
        setBase(form); setSuccess('Alterações salvas.'); setDiscard(false)
      } else { await create.mutateAsync({ ...payload, partner_id: admin ? form.partner_id : undefined }); onClose() }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.') }
  }
  async function discardAndClose() {
    setClosing(true); setError(null)
    try { await discardUploads.current?.(); onClose() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível descartar os envios.'); setClosing(false) }
  }
  function panelProps(name: ProspeccaoDetalheTab) { return { id: id + '-panel-' + name, role: 'tabpanel', 'aria-labelledby': id + '-tab-' + name, hidden: tab !== name, tabIndex: 0 } }
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close.current() }}>
      <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={id + '-title'} className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-silver-200 bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 py-5 sm:px-7"><div className="min-w-0"><span className="text-xs font-semibold uppercase tracking-widest text-red-600">{prospect ? PROSPECCAO_CLIENTE_STATUS_LABEL[prospect.status] : 'Novo prospect'}</span><h2 id={id + '-title'} className="mt-1 break-words text-xl font-bold text-slate-950">{prospect?.nome_completo ?? 'Adicionar cliente ao funil'}</h2><p className="mt-1 text-sm text-silver-500">Contato, notas e evidências em um só lugar.</p></div><button type="button" ref={closeButton} aria-label="Fechar detalhes" disabled={pending} onClick={() => close.current()} className="btn-no-liquid rounded-lg p-2 text-silver-500 hover:bg-silver-100"><X className="h-5 w-5" /></button></header>
        <ProspeccaoDetalheTabs id={id} value={tab} onChange={setTab} />
        {discard && <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm"><span>Descartar as alterações não salvas?</span><div className="flex gap-4"><button type="button" className="btn-no-liquid font-semibold" onClick={() => setDiscard(false)}>Continuar editando</button><button type="button" className="btn-no-liquid font-semibold text-danger" disabled={pending} onClick={() => void discardAndClose()}>Descartar rascunho</button></div></div>}
        <form onSubmit={event => void save(event)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-silver-50 px-5 py-5 sm:px-7">
            <div {...panelProps('dados')}>
              <fieldset disabled={readOnly || pending} className="space-y-5 rounded-xl border border-silver-200 bg-white p-5">
                {admin && !prospect && <div><label className="label">Parceiro responsável *</label>{partners.isPending ? <p className="text-sm">Carregando parceiros…</p> : partners.error ? <p role="alert" className="text-sm text-danger">Não foi possível carregar os parceiros.</p> : <SearchablePartnerSelect options={partners.data ?? []} value={form.partner_id} onChange={value => { patch('partner_id', value); patch('equipe_id', '') }} />}</div>}
                {admin && prospect && <p className="text-sm text-silver-600">Parceiro responsável: <strong>{partners.data?.find(partner => partner.partner_id === form.partner_id)?.nome ?? 'Parceiro atribuído'}</strong></p>}
                <label className="block"><span className="label">Nome completo *</span><input autoComplete="name" className="input mt-1" maxLength={160} value={form.nome_completo} onChange={event => patch('nome_completo', event.target.value)} /></label>
                <div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="label">E-mail</span><input className="input mt-1" type="email" autoComplete="email" value={form.email} onChange={event => patch('email', event.target.value)} /></label><label className="block"><span className="label">Telefone</span><input className="input mt-1" type="tel" autoComplete="tel" value={form.telefone} onChange={event => patch('telefone', prospeccaoClienteTelefoneDisplay(event.target.value))} /></label></div>
                <p className="text-xs text-silver-500">Informe ao menos um canal de contato.</p>
                <div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="label">Origem</span><select className="input mt-1" value={form.origem} onChange={event => patch('origem', event.target.value as Form['origem'])}><option value="">Não informada</option>{PROSPECCAO_CLIENTE_ORIGENS.map(value => <option key={value} value={value}>{PROSPECCAO_CLIENTE_ORIGEM_LABEL[value]}</option>)}</select></label>
                  {(admin || session?.role === 'partner') && <label className="block"><span className="label">Equipe</span><select className="input mt-1" value={form.equipe_id} disabled={teams.isPending || teams.isError || !form.partner_id} onChange={event => patch('equipe_id', event.target.value)}><option value="">Sem equipe específica</option>{teamOptions.map(team => <option value={team.id} key={team.id}>{team.nome}</option>)}</select></label>}
                </div>{teams.error && <p role="alert" className="text-sm text-danger">Não foi possível carregar as equipes.</p>}
              </fieldset>
            </div>
            <div {...panelProps('notas')} className="rounded-xl border border-silver-200 bg-white p-5"><label className="block"><span className="label">Notas da negociação</span><textarea className="input mt-3 min-h-64 resize-y py-3" placeholder="Registre o contexto necessário para o próximo contato…" maxLength={2000} disabled={readOnly || pending} value={form.notas} onChange={event => patch('notas', event.target.value)} /></label><p className="mt-2 text-right text-xs text-silver-500">{form.notas.length}/2000</p></div>
            <div {...panelProps('anexos')}>{prospect ? <ProspeccaoClienteAnexos id={prospect.id} readOnly={readOnly} onBusy={setUploadBusy} onDraft={setUploadDraft} discardRef={discardUploads} /> : <p className="rounded-xl border border-silver-200 bg-white p-5 text-sm text-silver-600">Crie o prospect para poder anexar os prints.</p>}</div>
            <div {...panelProps('historico')} className="rounded-xl border border-silver-200 bg-white p-5"><h3 className="font-semibold text-slate-950">Histórico de etapas</h3>{!prospect ? <p className="mt-3 text-sm text-silver-500">O histórico começa após a criação do prospect.</p> : history.isPending ? <p className="mt-3 text-sm" role="status">Carregando histórico…</p> : history.error ? <p role="alert" className="mt-3 text-sm text-danger">{history.error.message}</p> : <ol className="mt-4 space-y-4">{history.data?.map(item => <li key={item.id} className="border-l-2 border-red-200 pl-4"><p className="text-sm font-semibold text-silver-900">{PROSPECCAO_CLIENTE_STATUS_LABEL[item.status_novo as keyof typeof PROSPECCAO_CLIENTE_STATUS_LABEL] ?? item.status_novo}</p><time className="text-xs text-silver-500" dateTime={item.alterado_em}>{new Date(item.alterado_em).toLocaleString('pt-BR')}</time>{item.motivo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-silver-600">{item.motivo}</p>}</li>)}</ol>}</div>
          </div>
          {(error || success || readOnly) && <div className="shrink-0 border-t border-silver-100 px-5 py-3 text-sm">{error && <p role="alert" className="text-danger">{error}</p>}{success && <p role="status" className="text-success">{success}</p>}{readOnly && <p className="text-silver-500">Prospect convertido. Os dados estão disponíveis para consulta.</p>}</div>}
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-silver-200 bg-white px-5 py-4 sm:px-7"><button type="button" className="btn-no-liquid border border-silver-300 bg-white text-silver-800 hover:bg-silver-100" disabled={pending} onClick={() => close.current()}>Fechar</button>{prospect?.proposta_id && <Link className="btn-no-liquid border border-silver-300 bg-white text-silver-800 hover:bg-silver-100" to={(admin ? '/admin' : '/p') + '/propostas/' + prospect.proposta_id}>Abrir proposta</Link>}{!readOnly && <button type="submit" disabled={pending || (Boolean(prospect) && !dirty)} className="btn-no-liquid bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">{(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}{prospect ? 'Salvar alterações' : 'Criar prospect'}</button>}</footer>
        </form>
      </section>
    </div>, document.body,
  )
}

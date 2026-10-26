import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Eye, Globe2, Inbox, Loader2, Mail, Phone, Search, TrendingUp, UserRoundPlus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import 'react-day-picker/style.css'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { adminNivelOf } from '@/lib/adminScope'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmailStatusBadge, SimulacaoLeadDetalhe, WhatsAppContact } from '@/components/SimulacaoLeadDetalhe'
import { formatLeadPhone, type ConfigMensagensSimulador } from '@/lib/mensagensSimulador'
import { commercialStatusLabel, leadMoney, leadProjectStage, leadReceived, leadType, type CommercialStatus, type EmailStatus, type LeadRow } from '@/lib/simulacaoLeadPresentation'
import { LeadGeographyMap } from '@/components/admin/LeadGeographyMap'
import { BRAZIL_UFS } from '@/lib/brStates'
import './leads-simulacoes.css'

const filterControl = 'h-11 w-full rounded-lg border border-silver-300 bg-white text-sm text-silver-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/20'
const PAGE_SIZE = 50
type Period = '7' | '30' | 'quarter' | 'year' | 'all'
function periodStart(period: Period): Date | null {
  const now = new Date()
  if (period === 'all') return null
  if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  if (period === 'year') return new Date(now.getFullYear(), 0, 1)
  return new Date(now.getTime() - Number(period) * 86400000)
}

type Location = { cidade: string; uf: string }
async function lookupLocations(ceps: string[]): Promise<Record<string, Location>> {
  const result: Record<string, Location> = {}
  let index = 0
  await Promise.all(Array.from({ length: Math.min(4, ceps.length) }, async () => {
    while (index < ceps.length) {
      const cep = ceps[index++]
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
        if (!response.ok) continue
        const data = await response.json() as { localidade?: string; uf?: string; erro?: boolean }
        if (!data.erro && data.localidade && data.uf) result[cep] = { cidade: data.localidade, uf: data.uf }
      } catch { /* localização indisponível; a lista continua utilizável */ }
    }
  }))
  return result
}

function Stat({ icon, label, value, detail, emphasis = false }: { icon: ReactNode; label: string; value: string; detail: string; emphasis?: boolean }) {
  return <article className={`admin-leads__stat${emphasis ? ' is-emphasis' : ''}`}><div className="admin-leads__stat-top"><span>{icon}</span>{label}</div><strong>{value}</strong><small>{detail}</small></article>
}

export function AdminLeadsSimulacoes() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const canEditCommercial = ['full', 'limitado'].includes(adminNivelOf(session) ?? '')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [emailStatus, setEmailStatus] = useState<'all' | EmailStatus>('all')
  const [commercialStatus, setCommercialStatus] = useState<'all' | CommercialStatus>('all')
  const [statusNotice, setStatusNotice] = useState('')
  const [product, setProduct] = useState('all')
  const [period, setPeriod] = useState<Period>('30')
  const [region, setRegion] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pageSize = PAGE_SIZE

  const messageConfigQuery = useQuery({
    queryKey: ['admin-simulador-contact-message-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('config_mensagens_simulador').select('fallback, regras').eq('id', true).maybeSingle()
      if (error) throw error
      return data as ConfigMensagensSimulador | null
    },
  })
  const messageConfig = messageConfigQuery.data

  const leadsQuery = useQuery({
    queryKey: ['admin-public-simulation-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_leads_publicos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as LeadRow[]
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, next, expected }: { id: string; next: CommercialStatus; expected: CommercialStatus }) => {
      const { error } = await supabase.rpc('admin_set_lead_status_comercial', {
        p_lead_id: id,
        p_novo_status: next,
        p_status_esperado: expected,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setStatusNotice('Estado comercial atualizado.')
      await queryClient.invalidateQueries({ queryKey: ['admin-public-simulation-leads'] })
    },
    onError: async (error: Error) => {
      setStatusNotice(error.message.includes('status_comercial_conflito')
        ? 'O estado foi alterado por outra pessoa. A lista foi atualizada; revise antes de tentar novamente.'
        : 'Não foi possível atualizar o estado comercial. Tente novamente.')
      await queryClient.invalidateQueries({ queryKey: ['admin-public-simulation-leads'] })
    },
  })

  const ceps = useMemo(() => [...new Set((leadsQuery.data ?? []).map(lead => lead.cep?.replace(/\D/g, '') ?? '').filter(cep => cep.length === 8))].sort(), [leadsQuery.data])
  const locationsQuery = useQuery({
    queryKey: ['admin-public-simulation-lead-locations', ceps],
    queryFn: () => lookupLocations(ceps),
    enabled: ceps.length > 0,
    staleTime: 60 * 60 * 1000,
  })
  const locationFor = useCallback((lead: LeadRow): Location | null => {
    if (lead.cidade && lead.uf) return { cidade: lead.cidade, uf: lead.uf }
    const cep = lead.cep?.replace(/\D/g, '') ?? ''
    return locationsQuery.data?.[cep] ?? null
  }, [locationsQuery.data])

  const leadsBeforeRegion = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fromDate = from ? new Date(`${from}T00:00:00`) : null
    const toDate = to ? new Date(`${to}T23:59:59.999`) : null
    const periodDate = periodStart(period)

    return (leadsQuery.data ?? []).filter((lead) => {
      const created = new Date(lead.created_at)
      const location = locationFor(lead)
      const matchesSearch = !term || [lead.nome_completo, lead.email, lead.telefone, location?.cidade, location?.uf].some(value => value?.toLowerCase().includes(term))
      const matchesFrom = !fromDate || created >= fromDate
      const matchesTo = !toDate || created <= toDate
      const matchesStatus = emailStatus === 'all' || lead.status_email_prospect === emailStatus || lead.status_email_interno === emailStatus
      const matchesCommercialStatus = commercialStatus === 'all' || (lead.status_comercial ?? 'novo') === commercialStatus
      const matchesProduct = product === 'all' || lead.tipo_simulacao === product
      const matchesPeriod = !periodDate || created >= periodDate
      return matchesSearch && matchesFrom && matchesTo && matchesStatus && matchesCommercialStatus && matchesProduct && matchesPeriod
    })
  }, [commercialStatus, emailStatus, from, leadsQuery.data, locationFor, period, product, search, to])
  const leads = useMemo(() => leadsBeforeRegion.filter((lead) => {
    const location = locationFor(lead)
    return region === 'all' || (region === 'unknown' ? !location : location?.uf === region)
  }), [leadsBeforeRegion, locationFor, region])
  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleLeads = leads.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedLead = (leadsQuery.data ?? []).find(lead => lead.id === selectedId) ?? null

  useEffect(() => {
    setPage(1)
  }, [commercialStatus, emailStatus, from, period, product, region, search, to])

  const closeDetails = useCallback(() => setSelectedId(null), [])
  const hasFilters = Boolean(search.trim() || from || to || emailStatus !== 'all' || commercialStatus !== 'all' || product !== 'all' || period !== '30' || region !== 'all')
  const invalidRange = Boolean(from && to && from > to)
  // A seleção de UF filtra a tabela, mas não recalcula a demografia do mapa.
  const located = leadsBeforeRegion.filter(lead => locationFor(lead))
  const unlocatedCount = leadsBeforeRegion.length - located.length
  const ufCounts = located.reduce<Record<string, number>>((counts, lead) => {
    const uf = locationFor(lead)?.uf
    if (uf) counts[uf] = (counts[uf] ?? 0) + 1
    return counts
  }, {})
  const topUf = Object.entries(ufCounts).sort((a, b) => b[1] - a[1])[0]
  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.valor_credito) || 0), 0)
  const averageValue = leads.filter(lead => Number(lead.valor_credito) > 0).length
    ? totalValue / leads.filter(lead => Number(lead.valor_credito) > 0).length : 0
  const receivedProspect = leads.filter(lead => lead.status_email_prospect === 'enviado').length
  const prospectEligible = leads.filter(lead => lead.tipo_simulacao !== 'cpc').length
  const responseRate = prospectEligible ? Math.round(receivedProspect / prospectEligible * 100) : null
  const recentLeads = showAll ? visibleLeads : leads.slice(0, 6)
  const ufs = BRAZIL_UFS

  return (
    <div className="admin-leads">
      <div className="admin-leads__heading">
        <div><p className="admin-leads__eyebrow">VISÃO GERAL</p><h1>Distribuição de leads</h1><p>Entenda de onde vêm as oportunidades e acompanhe a localização dos imóveis e projetos.</p></div>
        <div className="admin-leads__heading-filters">
          <label>Período<select value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="quarter">Este trimestre</option><option value="year">Este ano</option><option value="all">Todo o período</option></select></label>
          <label>Produto<select value={product} onChange={event => setProduct(event.target.value)}><option value="all">Todos os produtos</option><option value="home_equity">Home Equity</option><option value="amortizacao">Amortização</option><option value="cpc">Crédito para Construção</option></select></label>
        </div>
      </div>

      <section className="admin-leads__stats" aria-label="Indicadores dos leads filtrados">
        <Stat icon={<UserRoundPlus />} label="Leads encontrados" value={String(leads.length)} detail="Nos filtros selecionados" emphasis />
        <Stat icon={<Globe2 />} label="Localizações identificadas" value={String(located.length)} detail={`${unlocatedCount} sem localização`} />
        <Stat icon={<TrendingUp />} label="Volume potencial" value={leads.some(lead => lead.valor_credito != null) ? leadMoney(totalValue) : '—'} detail="Soma dos créditos informados" />
        <Stat icon={<Mail />} label="E-mails ao prospect enviados" value={responseRate === null ? '—' : `${responseRate}%`} detail={`${receivedProspect} de ${prospectEligible} leads de simulador`} />
      </section>

      <section className="admin-leads__analytics" aria-label="Distribuição geográfica">
        <div className="admin-leads__panel admin-leads__map-panel">
          <div className="admin-leads__panel-header"><div><h2>Presença geográfica</h2><p>Localização dos imóveis e projetos informados pelos leads</p></div><label>Região<select value={region} onChange={event => setRegion(event.target.value)}><option value="all">Todas as regiões</option>{ufs.map(uf => <option key={uf} value={uf}>{uf}</option>)}<option value="unknown">Não informada</option></select></label></div>
          <LeadGeographyMap ufCounts={ufCounts} locatedCount={located.length} selectedRegion={region} onSelectRegion={setRegion} />
          <p className="admin-leads__map-note">Distribuição brasileira por UF · {locationsQuery.isFetching ? 'Consultando CEPs…' : `${unlocatedCount} sem localização identificada`}</p>
        </div>
        <aside className="admin-leads__panel admin-leads__insight"><p className="admin-leads__eyebrow">REGIÃO EM DESTAQUE</p><h2>{topUf ? topUf[0] : 'Sem localização'}</h2><p>{topUf ? 'UF com maior número de imóveis ou projetos localizados neste recorte.' : 'Os leads deste recorte ainda não têm localização resolvida.'}</p><div className="admin-leads__donut" style={{ '--progress': `${located.length ? Math.round((topUf?.[1] ?? 0) / located.length * 360) : 0}deg` } as CSSProperties}><div><strong>{topUf?.[1] ?? 0}</strong><span>leads</span></div></div><div className="admin-leads__uf-list">{Object.entries(ufCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uf, count]) => <div key={uf}><span>{uf}</span><strong>{count}</strong></div>)}<div><span>Ticket médio informado</span><strong>{averageValue ? leadMoney(averageValue) : '—'}</strong></div><div><span>Sem localização</span><strong>{unlocatedCount}</strong></div></div></aside>
      </section>

      <section aria-label="Filtros de leads" className="admin-leads__filters">
        <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_165px_165px_185px_185px]">
          <label className="block text-xs font-medium text-silver-700">
            Buscar lead
            <span className="relative mt-2 block"><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-silver-600" /><input className={`${filterControl} pl-10 pr-3`} placeholder="Nome, e-mail ou telefone" value={search} onChange={event => setSearch(event.target.value)} /></span>
          </label>
          <OptionalDateFilter label="Recebido de" value={from} onChange={setFrom} invalid={invalidRange} />
          <OptionalDateFilter label="Recebido até" value={to} onChange={setTo} invalid={invalidRange} />
          <label className="block text-xs font-medium text-silver-700">
            Estado do e-mail
            <span className="relative mt-2 block">
              <select className={`${filterControl} appearance-none pl-3 pr-10`} value={emailStatus} onChange={event => setEmailStatus(event.target.value as typeof emailStatus)}>
                <option value="all">Todos os estados</option><option value="pendente">Pendente</option><option value="enviado">Enviado</option><option value="erro">Erro</option><option value="sem_template">Sem template</option><option value="sem_destinatarios">Sem destinatários</option>
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-silver-600" />
            </span>
          </label>
          <label className="block text-xs font-medium text-silver-700">
            Estado comercial
            <span className="relative mt-2 block">
              <select className={`${filterControl} appearance-none pl-3 pr-10`} value={commercialStatus} onChange={event => setCommercialStatus(event.target.value as typeof commercialStatus)}>
                <option value="all">Todos os estados</option>
                {Object.entries(commercialStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-silver-600" />
            </span>
          </label>
        </div>
        {invalidRange && <p role="alert" className="mt-3 text-sm text-red-700">A data final deve ser igual ou posterior à data inicial.</p>}
        {hasFilters && <div className="mt-3 flex justify-end"><Button variant="ghost" className="btn-no-liquid h-11" onClick={() => { setSearch(''); setFrom(''); setTo(''); setEmailStatus('all'); setCommercialStatus('all'); setProduct('all'); setPeriod('30'); setRegion('all') }}>Limpar filtros</Button></div>}
      </section>

      {statusNotice && <div role="status" className="admin-leads__status-notice">{statusNotice}<button type="button" className="btn-no-liquid" aria-label="Fechar aviso" onClick={() => setStatusNotice('')}>×</button></div>}

      <section aria-label="Lista de leads" className="admin-leads__panel admin-leads__list">
        <div className="admin-leads__list-header"><div><h2>Leads recentes</h2><p>{leads.length} oportunidades encontradas nos filtros selecionados</p></div></div>
        {leadsQuery.isLoading ? <div role="status" className="flex min-h-64 items-center justify-center gap-3 p-6 text-sm text-silver-700"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-red-700" />Carregando leads…</div>
          : leadsQuery.error ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><AlertCircle aria-hidden="true" className="h-7 w-7 text-red-700" /><p className="font-medium">Não foi possível carregar os leads internos.</p><p className="text-sm text-silver-700">Tente novamente para atualizar a lista.</p><Button variant="outline" className="mt-1 h-11" onClick={() => void leadsQuery.refetch()}>Tentar novamente</Button></div>
              : leads.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><Inbox aria-hidden="true" className="h-8 w-8 text-silver-600" /><p className="font-medium">{hasFilters ? 'Nenhum lead encontrado' : 'Nenhum lead recebido'}</p><p className="max-w-sm text-sm text-silver-700">{hasFilters ? 'Revise a busca ou os filtros para encontrar outros resultados.' : 'As simulações e solicitações CPC enviadas pelo site aparecerão aqui.'}</p></div>
              : <>
                <div role="region" aria-label="Tabela de leads, role horizontalmente para ver todas as colunas" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-700/40">
                  <table className="admin-leads__table">
                    <caption className="sr-only">Leads públicos do site, ordenados do mais recente para o mais antigo</caption>
                    <thead><tr><th>Lead</th><th>Localização</th><th>Produto</th><th>Volume potencial</th><th>Estado comercial</th><th>Estado do e-mail</th><th>Recebido</th><th>Ações</th></tr></thead>
                    <tbody>{(showAll ? visibleLeads : recentLeads).map(lead => {
                      const location = locationFor(lead)
                      const received = leadReceived(lead.created_at)
                      return <tr key={lead.id}>
                        <td><strong>{lead.nome_completo}</strong><span className="admin-leads__contact"><Mail aria-hidden="true" />{lead.email}</span><span className="admin-leads__contact"><Phone aria-hidden="true" />{formatLeadPhone(lead.telefone)}</span></td>
                        <td><strong>{location?.cidade ?? 'Não informada'}</strong><small>{location ? `${location.uf} · Brasil` : 'Localização indisponível'}</small></td>
                        <td><span className="admin-leads__product">{leadType(lead)}</span></td>
                        <td><strong>{lead.tipo_simulacao === 'cpc' ? 'Não informado' : leadMoney(lead.valor_credito)}</strong><small>{lead.tipo_simulacao === 'cpc' ? leadProjectStage(lead.fase_projeto) : 'Crédito solicitado'}</small></td>
                        <td><label className="admin-leads__commercial-label"><span className="sr-only">Estado comercial de {lead.nome_completo}</span><select className={`admin-leads__commercial-select is-${lead.status_comercial ?? 'novo'}`} value={lead.status_comercial ?? 'novo'} disabled={!canEditCommercial || statusMutation.isPending} title={canEditCommercial ? 'Alterar estado comercial' : 'Somente leitura'} onChange={event => statusMutation.mutate({ id: lead.id, next: event.target.value as CommercialStatus, expected: lead.status_comercial ?? 'novo' })}>{Object.entries(commercialStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></td>
                        <td><div className="admin-leads__email-status">{lead.status_email_prospect && <EmailStatusBadge label="Prospect" status={lead.status_email_prospect} />}{lead.status_email_interno && <EmailStatusBadge label="Equipe" status={lead.status_email_interno} />}{!lead.status_email_prospect && !lead.status_email_interno && <span className="admin-leads__muted">Não aplicável</span>}</div></td>
                        <td><strong>{received.date}</strong><small>{received.time}</small></td>
                        <td><div className="admin-leads__row-actions"><Button variant="outline" className="btn-no-liquid" aria-label={`Ver detalhes de ${lead.nome_completo}`} aria-haspopup="dialog" onClick={() => setSelectedId(lead.id)}><Eye aria-hidden="true" className="h-4 w-4" />Ver</Button><WhatsAppContact lead={lead} config={messageConfig} compact /></div></td>
                      </tr>
                    })}</tbody>
                  </table>
                </div>
                <footer className="admin-leads__footer">
                  <p>Exibindo {showAll ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, leads.length)}` : Math.min(6, leads.length)} de {leads.length} leads</p>
                  {showAll ? <nav aria-label="Paginação de leads" className="admin-leads__pages"><Button variant="outline" className="btn-no-liquid" disabled={currentPage <= 1} aria-label="Página anterior" onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button><span>Página {currentPage} de {totalPages}</span><Button variant="outline" className="btn-no-liquid" disabled={currentPage >= totalPages} aria-label="Próxima página" onClick={() => setPage(Math.min(totalPages, currentPage + 1))}><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button></nav> : <button type="button" className="btn-no-liquid admin-leads__view-all" onClick={() => setShowAll(true)}>Ver todos os leads <ArrowRight aria-hidden="true" size={16} /></button>}
                </footer>
              </>}
      </section>
      {(leadsQuery.data?.length ?? 0) >= 500 && <p className="text-xs text-silver-700">A lista considera os 500 leads públicos mais recentes.</p>}
      {selectedLead && <SimulacaoLeadDetalhe lead={selectedLead} config={messageConfig} onClose={closeDetails} />}
    </div>
  )
}

const calendarClasses = getDefaultClassNames()

function OptionalDateFilter({ label, value, onChange, invalid }: { label: string; value: string; onChange: (date: string) => void; invalid: boolean }) {
  const [open, setOpen] = useState(false)
  return <div>
    <span className="mb-2 block text-xs font-medium text-silver-700">{label}</span>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline" aria-label={`${label}: ${value ? format(parseISO(value), 'dd/MM/yyyy') : 'sem limite'}`} aria-invalid={invalid || undefined} className="h-11 w-full justify-start rounded-lg font-normal"><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-silver-600" /><span>{value ? format(parseISO(value), 'dd/MM/yyyy') : 'dd/mm/aaaa'}</span></Button></PopoverTrigger>
      <PopoverContent align="start" aria-label={`Selecionar data: ${label}`} className="w-auto max-w-[calc(100vw-2rem)] overflow-auto text-silver-900 [color-scheme:light]">
        <DayPicker mode="single" locale={ptBR} selected={value ? parseISO(value) : undefined} defaultMonth={value ? parseISO(value) : new Date()} onSelect={date => { onChange(date ? format(date, 'yyyy-MM-dd') : ''); setOpen(false) }}
          labels={{ labelPrevious: () => 'Mês anterior', labelNext: () => 'Próximo mês', labelNav: () => 'Navegação do calendário' }}
          style={{ '--rdp-accent-color': '#B91C1C', '--rdp-accent-background-color': '#FEF2F2', '--rdp-today-color': '#B91C1C' } as CSSProperties}
          classNames={{
            button_previous: `${calendarClasses.button_previous} btn-no-liquid h-11 w-11 p-0 text-silver-700 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0`,
            button_next: `${calendarClasses.button_next} btn-no-liquid h-11 w-11 p-0 text-silver-700 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0`,
            day_button: `${calendarClasses.day_button} btn-no-liquid rounded-md text-sm hover:bg-red-50 focus-visible:outline-red-700`,
          }}
        />
        <div className="mt-3 flex justify-end border-t border-silver-200 pt-3"><Button variant="ghost" className="h-11" onClick={() => { onChange(''); setOpen(false) }}>Limpar data</Button></div>
      </PopoverContent>
    </Popover>
  </div>
}

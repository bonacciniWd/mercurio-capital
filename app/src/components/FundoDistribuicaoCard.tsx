import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ObservacoesKanbanContext } from '@/components/observacoesKanbanContext'
import { PropostaObservacoesButton } from '@/components/PropostaObservacoesButton'
import { PropostaObservacoesModal, type PropostaObservacoesModalProposta } from '@/components/PropostaObservacoesModal'
import { usePropostaObservacaoContagem } from '@/hooks/usePropostaObservacoes'
import { brl } from '@/lib/utils'
import { sumFundWinnerTotals, type FundWinnerTotalsRow } from '@/lib/fundosDashboard'
import { FUND_PROPOSAL_FILTERS, getFundProposalFilterRule, sumFundRequestedVolume, type FundProposalFilter } from '@/lib/fundProposalFilter'

interface FundRow extends FundWinnerTotalsRow {
  fundo_id: string
  nome: string
  cor_hex: string
  operacoes_representadas: number
  operacoes_canceladas: number
  volume_cancelado: number | string
}

interface FundData {
  fundos: FundRow[]
  operacoes_sem_fundo_vencedor: number
  volume_solicitado_sem_fundo_vencedor: number
  operacoes_canceladas_sem_fundo_vencedor: number
  volume_cancelado_sem_fundo_vencedor: number
  operacoes_vencedor_em_outro_fundo: number
  volume_vencedor_em_outro_fundo: number
  operacoes_unicas: number
  operacoes_canceladas: number
  operacoes_ativas: number
  operacoes_standby: number
  volume_solicitado_unico: number
  volume_cancelado: number
  volume_ganho_unico: number
}

interface FundProposal {
  id: string
  protocolo: string | null
  produto: string
  status: string
  status_vinculo: string
  valor_solicitado: number | string
  prazo_meses: number
  taxa_juros_mensal: number | string
  created_at: string
  cliente_nome: string | null
  pessoa_tipo: string | null
  documento: string | null
  fundo_vencedor: boolean
  primeira_aprovacao_em: string | null
}

interface FundProposalPage {
  total: number
  items: FundProposal[]
}

interface FundProposalSummary {
  total: number
  volume: number
}

interface FundAssignmentRecord {
  proposta_id: string
  status_fundo: string
  propostas: {
    id: string
    protocolo: string | null
    produto: string
    status: string
    valor_solicitado: number | string
    prazo_meses: number
    taxa_juros_mensal: number | string
    created_at: string
    cliente: {
      nome_completo: string
      pessoa_tipo: string
      cpf: string | null
      cnpj: string | null
    } | null
  }
}

interface Props { inicio: string; fim: string; fundo: string; partner: string }
const PAGE_SIZE = 50
const money = (value: number | string | undefined) => brl(Math.round(Number(value ?? 0) * 100))
const statusLabel: Record<string, string> = {
  registro_af: 'Registro de AF', contrato_registrado: 'Registro de AF', recurso_liberado: 'Recurso liberado',
  pagamento_comissao: 'Pagamento de comissão', completo: 'Concluído', cancelado: 'Cancelado', standby: 'Standby',
  pre_analise: 'Pré-análise', pre_aprovado: 'Pré-aprovado', analise_juridica: 'Análise jurídica',
  analise_credito: 'Análise de crédito', analise_imovel: 'Análise do imóvel', comite: 'Comitê',
  proposta_cliente: 'Proposta ao cliente', diligencia_juridica: 'Diligência jurídica', emissao_contrato: 'Emissão de contrato',
  aguardando_assinatura: 'Aguardando assinatura', protocolo_cartorio: 'Protocolo em cartório',
  exigencias_cartorio: 'Exigências de cartório', custas_cartorio: 'Custas de cartório',
}
const fundStatusLabel: Record<string, string> = {
  aguardando: 'Aguardando análise', aprovado: 'Aprovado', rejeitado: 'Rejeitado', atencao: 'Atenção',
}

function nextDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function FundoDistribuicaoCard({ inicio, fim, fundo, partner }: Props) {
  const [selectedFund, setSelectedFund] = useState(fundo)
  const [page, setPage] = useState(0)
  const [proposalFilter, setProposalFilter] = useState<FundProposalFilter>('all')
  const query = useQuery({
    queryKey: ['admin-dashboard-fundos', inicio, fim, fundo, partner],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard_fundos_analytics', {
        p_inicio: inicio, p_fim: fim, p_fundo: fundo || null, p_partner: partner || null, p_equipe: null,
      })
      if (error) throw error
      return data as FundData
    },
  })

  const data = query.data
  const rows = data?.fundos ?? []
  const activeFundId = rows.some(row => row.fundo_id === selectedFund) ? selectedFund : rows[0]?.fundo_id ?? ''
  const activeFund = rows.find(row => row.fundo_id === activeFundId)

  useEffect(() => {
    setSelectedFund(fundo || activeFundId)
    setPage(0)
  }, [fundo, activeFundId, inicio, fim, partner])

  const proposalsQuery = useQuery({
    queryKey: ['admin-dashboard-fundo-propostas', inicio, fim, activeFundId, partner, proposalFilter, page],
    enabled: Boolean(activeFundId),
    queryFn: async (): Promise<FundProposalPage> => {
      const firstInstant = `${inicio}T00:00:00-03:00`
      const endInstant = `${nextDate(fim)}T00:00:00-03:00`
      const firstRow = page * PAGE_SIZE
      const lastRow = firstRow + PAGE_SIZE - 1

      // These tables already have admin-only SELECT policies. Keeping this read
      // on the RLS-protected tables also works before the optional detail RPC is
      // installed in a given Supabase environment.
      let assignmentsQuery = supabase
        .from('proposta_fundos')
        .select('proposta_id, status_fundo, propostas!inner(id, protocolo, produto, status, valor_solicitado, prazo_meses, taxa_juros_mensal, created_at, cliente:clientes(nome_completo, pessoa_tipo, cpf, cnpj))', { count: 'exact' })
        .eq('fundo_id', activeFundId)
        .gte('propostas.created_at', firstInstant)
        .lt('propostas.created_at', endInstant)
        .order('created_at', { referencedTable: 'propostas', ascending: false })
        .order('id', { referencedTable: 'propostas', ascending: false })
      const filterRule = getFundProposalFilterRule(proposalFilter)
      if (filterRule.fundLinkStatus) assignmentsQuery = assignmentsQuery.eq('status_fundo', filterRule.fundLinkStatus)
      if (filterRule.proposalStatus) assignmentsQuery = assignmentsQuery.eq('propostas.status', filterRule.proposalStatus)
      if (filterRule.excludedProposalStatuses.length === 1) assignmentsQuery = assignmentsQuery.neq('propostas.status', filterRule.excludedProposalStatuses[0])
      else if (filterRule.excludedProposalStatuses.length > 1) assignmentsQuery = assignmentsQuery.not('propostas.status', 'in', `(${filterRule.excludedProposalStatuses.map(status => `"${status}"`).join(',')})`)
      if (partner) assignmentsQuery = assignmentsQuery.eq('propostas.partner_id', partner)
      const { data: assignmentsData, error: assignmentsError, count } = await assignmentsQuery.range(firstRow, lastRow)

      if (assignmentsError) throw assignmentsError
      const assignments = (assignmentsData ?? []) as unknown as FundAssignmentRecord[]
      const proposalIds = assignments.map(item => item.proposta_id)

      let winnerByProposal = new Map<string, { fundo_id: string; aprovado_em: string }>()
      if (proposalIds.length > 0) {
        const { data: approvalsData, error: approvalsError } = await supabase
          .from('proposta_fundos')
          .select('proposta_id, fundo_id, aprovado_em')
          .in('proposta_id', proposalIds)
          .not('aprovado_em', 'is', null)
          .order('aprovado_em', { ascending: true })
          .order('fundo_id', { ascending: true })

        if (approvalsError) throw approvalsError
        winnerByProposal = new Map()
        for (const approval of approvalsData ?? []) {
          if (!winnerByProposal.has(approval.proposta_id)) {
            winnerByProposal.set(approval.proposta_id, {
              fundo_id: approval.fundo_id,
              aprovado_em: approval.aprovado_em!,
            })
          }
        }
      }

      const items: FundProposal[] = assignments.map(assignment => {
        const proposal = assignment.propostas
        const client = proposal.cliente
        const winner = winnerByProposal.get(proposal.id)
        return {
          id: proposal.id,
          protocolo: proposal.protocolo,
          produto: proposal.produto,
          status: proposal.status,
          status_vinculo: assignment.status_fundo,
          valor_solicitado: proposal.valor_solicitado,
          prazo_meses: proposal.prazo_meses,
          taxa_juros_mensal: proposal.taxa_juros_mensal,
          created_at: proposal.created_at,
          cliente_nome: client?.nome_completo ?? null,
          pessoa_tipo: client?.pessoa_tipo ?? null,
          documento: client?.pessoa_tipo === 'PJ' ? client.cnpj : client?.cpf ?? null,
          fundo_vencedor: winner?.fundo_id === activeFundId,
          primeira_aprovacao_em: winner?.aprovado_em ?? null,
        }
      })

      return { total: count ?? 0, items }
    },
  })

  const proposalSummaryQuery = useQuery({
    queryKey: ['admin-dashboard-fundo-propostas-summary', inicio, fim, activeFundId, partner, proposalFilter],
    enabled: Boolean(activeFundId),
    queryFn: async (): Promise<FundProposalSummary> => {
      const firstInstant = `${inicio}T00:00:00-03:00`
      const endInstant = `${nextDate(fim)}T00:00:00-03:00`
      const batchSize = 500
      let offset = 0
      let total = 0
      const values: (number | string | null)[] = []

      while (true) {
        let summaryQuery = supabase
          .from('proposta_fundos')
          .select('proposta_id, propostas!inner(valor_solicitado, status, created_at)', { count: 'exact' })
          .eq('fundo_id', activeFundId)
          .gte('propostas.created_at', firstInstant)
          .lt('propostas.created_at', endInstant)
          .order('created_at', { referencedTable: 'propostas', ascending: false })
          .order('id', { referencedTable: 'propostas', ascending: false })

        const filterRule = getFundProposalFilterRule(proposalFilter)
        if (filterRule.fundLinkStatus) summaryQuery = summaryQuery.eq('status_fundo', filterRule.fundLinkStatus)
        if (filterRule.proposalStatus) summaryQuery = summaryQuery.eq('propostas.status', filterRule.proposalStatus)
        if (filterRule.excludedProposalStatuses.length === 1) summaryQuery = summaryQuery.neq('propostas.status', filterRule.excludedProposalStatuses[0])
        else if (filterRule.excludedProposalStatuses.length > 1) summaryQuery = summaryQuery.not('propostas.status', 'in', `(${filterRule.excludedProposalStatuses.map(status => `"${status}"`).join(',')})`)
        if (partner) summaryQuery = summaryQuery.eq('propostas.partner_id', partner)

        const { data: batchData, error: batchError, count } = await summaryQuery.range(offset, offset + batchSize - 1)
        if (batchError) throw batchError
        const batch = (batchData ?? []) as unknown as { propostas: { valor_solicitado: number | string | null } }[]
        if (offset === 0) total = count ?? 0
        values.push(...batch.map(item => item.propostas.valor_solicitado))
        offset += batch.length
        if (batch.length < batchSize || offset >= total) break
      }

      return { total, volume: sumFundRequestedVolume(values) }
    },
  })

  const proposalRows = useMemo(() => proposalsQuery.data?.items ?? [], [proposalsQuery.data])

  // Observações (issue #27): mesma função do Kanban — contagem em lote por página
  // visível + modal compartilhado com snapshot da linha (paginar não derruba rascunho).
  const obsIds = useMemo(() => proposalRows.map(p => p.id), [proposalRows])
  const { data: obsContagem = {} } = usePropostaObservacaoContagem(obsIds)
  const [obsProposta, setObsProposta] = useState<PropostaObservacoesModalProposta | null>(null)
  const obsCtx = useMemo(() => ({
    contagem: obsContagem,
    onOpen: (id: string) => {
      const row = proposalRows.find(p => p.id === id)
      if (row) setObsProposta({ id: row.id, protocolo: row.protocolo, cliente_nome: row.cliente_nome })
    },
  }), [obsContagem, proposalRows])

  const totals = sumFundWinnerTotals(rows)
  const maxAssignments = Math.max(...rows.map(row => Number(row.operacoes_representadas)), 0)
  const totalProposals = proposalSummaryQuery.data?.total ?? proposalsQuery.data?.total ?? 0
  const filteredRequestedVolume = proposalSummaryQuery.data?.volume ?? 0
  const pages = Math.max(1, Math.ceil(totalProposals / PAGE_SIZE))
  const firstItem = totalProposals ? page * PAGE_SIZE + 1 : 0
  const lastItem = Math.min((page + 1) * PAGE_SIZE, totalProposals)

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-[18px] border border-black/10 bg-[#fbfbfa] shadow-[0_20px_70px_rgba(18,18,18,0.08)]" aria-label="Distribuição de operações por fundo">
      <header className="flex flex-col gap-5 border-b border-black/10 px-5 py-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[.18em] text-[#e43d37]"><span className="grid h-7 w-7 place-items-center rounded-md bg-[#ef3f3a] text-white"><BarChart3 className="h-4 w-4" /></span> Visão de crédito</p>
          <h2 className="text-[clamp(1.65rem,3vw,2.65rem)] font-semibold leading-tight tracking-[-0.045em] text-[#151515]">Distribuição por fundos</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-black/50">Atribuições mostram vínculos por fundo; valores ficam no primeiro fundo aprovado.</p>
        </div>
        <div className="relative flex w-fit max-w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 sm:gap-7 sm:px-5 sm:py-3.5">
          <Metric label="Volume total do recorte" value={money(totals.volume_solicitado)} />
          <div className="h-9 w-px shrink-0 bg-black/10" />
          <Metric label="Operações únicas" value={String(totals.operacoes_unicas)} />
          <div className="group relative shrink-0">
            <button
              type="button"
              className="btn-no-liquid grid h-7 w-7 place-items-center rounded-full text-black/45 transition-colors hover:bg-black/[0.05] hover:text-[#c92f2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ef3f3a]"
              aria-label="Informações sobre os indicadores do resumo"
              aria-describedby="fund-summary-tooltip"
            >
              <Info aria-hidden="true" className="h-4 w-4" />
            </button>
            <div
              id="fund-summary-tooltip"
              role="tooltip"
              className="invisible rounded-lg border border-black/10 bg-[#202223] px-4 py-3 text-left text-[13px] font-normal normal-case leading-[1.45] tracking-normal text-white opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 30,
                display: 'block',
                width: 'min(25rem, calc(100vw - 2rem))',
                maxWidth: 'calc(100vw - 2rem)',
                boxSizing: 'border-box',
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
              }}
            >
              Período e filtros gerais do Dashboard. Soma o valor solicitado
              uma vez por proposta, no primeiro fundo aprovado. Inclui
              canceladas, exclui Standby; não é valor liberado.
            </div>
          </div>
        </div>
      </header>

      {query.isError ? <p className="m-6 rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">Não foi possível carregar a distribuição por fundos.</p> : query.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-silver-400" /></div> : (
        <div className="grid min-h-[520px] lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(320px,0.9fr)_minmax(500px,1.35fr)]">
          <aside className="min-w-0 border-b border-black/10 p-4 sm:p-5 md:border-b-0 md:border-r md:p-6" aria-label="Fundos disponíveis">
            <div className="mb-3 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[.13em] text-black/40"><span>Fundos disponíveis</span><span className="text-xs normal-case tracking-normal text-black/40">{rows.length} fundos</span></div>
            {rows.length === 0 ? <p className="rounded-lg bg-black/[0.035] p-4 text-sm text-silver-500">Nenhum fundo vinculado neste período.</p> : <ul role="tablist" aria-label="Selecionar fundo" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-4 lg:mx-0 lg:block lg:max-h-[635px] lg:space-y-1.5 lg:overflow-y-auto lg:px-0">
              {rows.map(row => <li key={row.fundo_id} className="w-full">
                <button id={`fund-tab-${row.fundo_id}`} type="button" role="tab" tabIndex={activeFundId === row.fundo_id ? 0 : -1} aria-selected={activeFundId === row.fundo_id} aria-controls="fund-detail" onKeyDown={event => { const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'; const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft'; if (!forward && !backward && event.key !== 'Home' && event.key !== 'End') return; event.preventDefault(); const tabs = Array.from(event.currentTarget.closest('[role=tablist]')?.querySelectorAll<HTMLButtonElement>('[role=tab]') ?? []); const index = tabs.indexOf(event.currentTarget); const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : forward ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length; tabs[nextIndex]?.focus(); tabs[nextIndex]?.click() }} onClick={() => { setSelectedFund(row.fundo_id); setPage(0) }} className={`btn-no-liquid relative !flex w-full !justify-start shrink-0 items-center gap-3 rounded-xl border px-3 py-3 text-left text-[#151515] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ef3f3a] ${activeFundId === row.fundo_id ? 'border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.08)] before:absolute before:bottom-3 before:left-0 before:top-3 before:w-[3px] before:rounded-r-full before:bg-[#ef3f3a]' : 'border-transparent hover:bg-black/[0.035]'} min-w-[220px] lg:min-w-0`}>
                  <span className="flex w-full min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: activeFundId === row.fundo_id ? '#ef3f3a' : row.cor_hex }}>{row.nome.slice(0,2).toLocaleUpperCase('pt-BR')}</span>
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{row.nome}</span><span className="shrink-0 text-xs font-medium text-black/50">{row.operacoes_representadas} atrib.</span></span><span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-black/[0.07]"><span className="block h-full rounded-full bg-[#d65b55]" style={{ width: `${Math.max(5, maxAssignments ? Number(row.operacoes_representadas) / maxAssignments * 100 : 0)}%` }} /></span><span className="sr-only">{row.operacoes_representadas} atribuições</span></span>
                    <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-black/30 ${activeFundId === row.fundo_id ? 'bg-[#ef3f3a] text-white' : ''}`}><ChevronRight className="h-4 w-4" /></span>
                  </span>
                </button>
              </li>)}
            </ul>}
            <div className="mt-2 border-t border-black/[0.07] pt-4 text-xs leading-5 text-black/50">
              <p>Volumes por fundo contam somente operações com aprovação registrada nesse fundo.</p>
            </div>
          </aside>

          <div id="fund-detail" role="tabpanel" aria-labelledby={activeFund ? `fund-tab-${activeFund.fundo_id}` : undefined} aria-live="polite" className="min-w-0 bg-[#f7f6f3] p-5 sm:p-8 lg:p-10">
            {!activeFund ? <div className="flex min-h-64 items-center justify-center text-sm text-silver-500">Selecione um fundo para consultar as operações.</div> : <>
              <div className="mb-6 flex flex-col gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-black/40">Fundo selecionado</p><h3 className="mt-2.5 flex items-center gap-3 text-2xl font-semibold tracking-[-0.035em] text-[#151515]"><span className="h-3 w-3 rounded-full bg-[#ef3f3a] shadow-[0_0_0_5px_rgba(239,63,58,0.11)]" />{activeFund.nome}</h3></div>
                <span className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60">{totalProposals} operação(ões) vinculada(s)</span>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10 sm:grid-cols-4">
                <Metric label="Operações filtradas" value={String(totalProposals)} />
                <Metric label="Volume vinculado" value={money(filteredRequestedVolume)} />
                <Metric label="Operações únicas" value={String(activeFund.operacoes_unicas)} />
                <Metric label="Volume ganho" value={money(activeFund.volume_ganho)} />
              </div>

              <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.05)]" aria-label={`Operações vinculadas ao fundo ${activeFund.nome}`}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-5 py-4 sm:px-6">
                  <div><h4 className="text-[10px] font-semibold uppercase tracking-[.13em] text-black/40">Operações do fundo</h4><p className="mt-1 text-xs text-black/50">Filtre as operações por situação.</p></div>
                  {proposalsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-silver-400" aria-label="Atualizando operações" />}
                </header>
                <div className="flex flex-wrap gap-2 border-b border-black/10 px-5 py-3 sm:px-6" role="group" aria-label="Filtrar operações por situação">
                  {FUND_PROPOSAL_FILTERS.map(filter => <button key={filter.value} type="button" aria-pressed={proposalFilter === filter.value} onClick={() => { setProposalFilter(filter.value); setPage(0) }} className={`btn-no-liquid min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${proposalFilter === filter.value ? 'border-[#ef3f3a] bg-[#ef3f3a] text-white' : 'border-black/10 bg-white text-black/60 hover:border-[#ef3f3a]/40 hover:text-[#c92f2a]'}`}>{filter.label}</button>)}
                </div>
                {proposalsQuery.isError || proposalSummaryQuery.isError ? <div className="p-5 text-sm text-danger"><p>Não foi possível carregar as operações deste fundo.</p><p className="mt-1 text-xs text-silver-500">Confirme sua sessão de Admin e tente novamente.</p></div> : proposalsQuery.isLoading || proposalSummaryQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-silver-400" /></div> : proposalRows.length ? (
                  <ObservacoesKanbanContext.Provider value={obsCtx}>
                  <ul className="max-h-[635px] divide-y divide-black/[0.07] overflow-y-auto">
                    {proposalRows.map(proposal => <li key={proposal.id} className="px-5 py-4 sm:px-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <Link to={`/admin/propostas/${proposal.id}`} className="font-mono text-xs font-semibold text-[#c92f2a] underline decoration-[#c92f2a]/30 underline-offset-2 hover:decoration-[#c92f2a]">{proposal.protocolo ?? proposal.id}</Link>
                          <h5 className="mt-1 truncate text-sm font-semibold text-[#151515]">{proposal.cliente_nome ?? 'Cliente não informado'}</h5>
                          <p className="mt-1 text-xs text-black/45">{proposal.produto} · {proposal.documento ?? 'Documento não informado'}</p>
                        </div>
                        <div className="shrink-0 sm:text-right"><p className="text-sm font-semibold tabular-nums text-[#151515]">{money(proposal.valor_solicitado)}</p><p className="mt-1 text-[11px] text-black/45">{proposal.prazo_meses} meses · {Number(proposal.taxa_juros_mensal).toLocaleString('pt-BR')}% a.m.</p></div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${proposal.status === 'standby' ? 'bg-silver-100 text-silver-600' : proposal.status === 'cancelado' ? 'bg-red-50 text-red-700' : 'bg-black/[0.045] text-black/60'}`}>Proposta: {statusLabel[proposal.status] ?? proposal.status}</span>
                        <span className="rounded-full bg-black/[0.045] px-2.5 py-1 text-[10px] font-medium text-black/60">Fundo: {fundStatusLabel[proposal.status_vinculo] ?? proposal.status_vinculo}</span>
                        {proposal.fundo_vencedor && <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700">Primeiro fundo aprovado{proposal.primeira_aprovacao_em ? ` · ${formatDate(proposal.primeira_aprovacao_em)}` : ''}</span>}
                        <PropostaObservacoesButton cardId={proposal.id} variant="chip" />
                      </div>
                    </li>)}
                  </ul>
                  </ObservacoesKanbanContext.Provider>
                ) : <p className="p-8 text-center text-sm text-silver-500">Nenhuma operação encontrada para este filtro neste período.</p>}
                {totalProposals > PAGE_SIZE && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-silver-100 px-5 py-3 text-xs text-silver-500"><span>Exibindo {firstItem}–{lastItem} de {totalProposals}</span><div className="flex items-center gap-2"><button className="btn-no-liquid min-h-9 min-w-9 rounded-md border border-silver-200 p-2 disabled:opacity-40" type="button" aria-label="Página anterior" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" /></button><span>Página {page + 1} de {pages}</span><button className="btn-no-liquid min-h-9 min-w-9 rounded-md border border-silver-200 p-2 disabled:opacity-40" type="button" aria-label="Próxima página" disabled={page + 1 >= pages} onClick={() => setPage(value => Math.min(pages - 1, value + 1))}><ChevronRight className="h-4 w-4" /></button></div></footer>}
              </section>

              {Boolean(data?.operacoes_sem_fundo_vencedor || data?.operacoes_vencedor_em_outro_fundo) && <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#e7b559]/50 bg-[#fffaf0] p-4 text-xs leading-5 text-black/60"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d58b20]" /><div>{data?.operacoes_sem_fundo_vencedor ? <p>{data.operacoes_sem_fundo_vencedor} operação(ões), com {money(data.volume_solicitado_sem_fundo_vencedor)} solicitados, ainda sem vencedor. {data.operacoes_canceladas_sem_fundo_vencedor ? `Inclui ${data.operacoes_canceladas_sem_fundo_vencedor} canceladas (${money(data.volume_cancelado_sem_fundo_vencedor)}).` : ''}</p> : <p>Este filtro considera propostas vinculadas ao fundo; valores pertencentes a outro fundo vencedor não são atribuídos aqui.</p>}{Boolean(data?.operacoes_vencedor_em_outro_fundo) && <p className="mt-1">{data?.operacoes_vencedor_em_outro_fundo} operação(ões) vinculadas a este fundo têm outro vencedor; {money(data?.volume_vencedor_em_outro_fundo)} fica atribuído ao primeiro fundo aprovado.</p>}</div></div>}
              {Number(activeFund.operacoes_canceladas) > 0 && <p className="mt-3 text-xs text-silver-500">O volume solicitado inclui {activeFund.operacoes_canceladas} operação(ões) cancelada(s), conforme a regra da produção histórica; volume ganho considera apenas as etapas de ganho.</p>}
            </>}
          </div>
        </div>
      )}
      <footer className="border-t border-black/10 px-5 py-4 text-[11px] leading-5 text-black/40 sm:px-8">Uma proposta pode aparecer em mais de um fundo nas atribuições. O total financeiro conta cada operação uma vez, no primeiro fundo aprovado.</footer>

      {obsProposta && (
        <PropostaObservacoesModal
          key={obsProposta.id}
          proposta={obsProposta}
          onClose={() => setObsProposta(null)}
        />
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-white px-4 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-black/40">{label}</p><p className="mt-2 truncate text-sm font-semibold leading-tight tabular-nums text-[#151515]" title={value}>{value}</p></div>
}

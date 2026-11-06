import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { KPICard } from '@/components/KPICard'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import logoWide from '@/assets/logos/logowide.png'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { adminNivelOf } from '@/lib/adminScope'
import { useAuth } from '@/auth/AuthContext'
import {
  countProposalStages, downloadTextFile, formatExportSheetsForPrint, getRelatorioRange,
  reportPrintHtml, spreadsheetXml, timestampRange,
  type ExportCell, type RelatorioPreset,
} from '@/lib/adminRelatorios'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Construção',
  financiamento_imobiliario: 'Financiamento',
}

const PRODUTO_COLORS: Record<string, string> = {
  home_equity: '#D10000',
  credito_construcao: '#3A3A3A',
  financiamento_imobiliario: '#98A3AF',
}
const EMPTY_PROPOSTAS: PropostaRow[] = []

interface Analytics {
  total_propostas: number
  ativas: number
  ganhas: number
  taxa_conversao: number
  volume_ganho: number
  volume_total: number
  serie: Array<{ periodo: string; propostas: number; ganhas: number; volume_solicitado: number; volume_ganho: number }>
  top_parceiros: Array<{ partner_id: string; partner_nome: string; total: number; ganhas: number; volume_ganho: number }>
}
interface Finance {
  entradas_realizadas: number
  saidas_realizadas: number
  entradas_previstas: number
  saidas_previstas: number
  custos_operacionais: number
  custos_pessoal: number
  pendencias: number
}
interface PropostaRow { produto: string | null; status: string | null; valor_solicitado: number | string | null }
interface LeadCounts { cadastrados: number; atendidos: number }

const money = (value: number | string | null | undefined) => brl(Math.round(Number(value ?? 0) * 100))
const fileStamp = (date: string) => date.replace(/-/g, '')

export function AdminRelatorios() {
  const { session } = useAuth()
  const nivelAdmin = adminNivelOf(session)
  const [periodo, setPeriodo] = useState<RelatorioPreset>('12m')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [exportNotice, setExportNotice] = useState('')
  const range = useMemo(() => rangeFrom || rangeTo
    ? { inicio: rangeFrom || rangeTo, fim: rangeTo || rangeFrom }
    : getRelatorioRange(periodo), [periodo, rangeFrom, rangeTo])
  const bounds = useMemo(() => timestampRange(range), [range])

  const analyticsQuery = useQuery({
    queryKey: ['admin-rel-analytics', range.inicio, range.fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard_analytics', {
        p_inicio: range.inicio, p_fim: range.fim, p_fundo: null, p_partner: null, p_equipe: null,
      })
      if (error) throw error
      return data as Analytics
    },
  })

  const propostasQuery = useQuery({
    queryKey: ['admin-rel-propostas', range.inicio, range.fim],
    queryFn: async () => {
      const pageSize = 1000
      const maxRows = 100_000
      const rows: PropostaRow[] = []
      for (let offset = 0; offset < maxRows; offset += pageSize) {
        const { data, error } = await supabase
          .from('propostas')
          .select('produto, status, valor_solicitado')
          .gte('created_at', bounds.inicio)
          .lt('created_at', bounds.fimExclusivo)
          .range(offset, offset + pageSize - 1)
        if (error) throw error
        const page = (data ?? []) as PropostaRow[]
        rows.push(...page)
        if (page.length < pageSize) return rows
      }
      throw new Error('O período contém mais de 100.000 propostas; reduza o intervalo para gerar o relatório.')
    },
  })

  const leadsQuery = useQuery({
    queryKey: ['admin-rel-leads', range.inicio, range.fim],
    queryFn: async (): Promise<LeadCounts> => {
      const base = () => supabase.from('v_admin_leads_publicos').select('id', { count: 'exact', head: true })
        .gte('created_at', bounds.inicio).lt('created_at', bounds.fimExclusivo)
      const [all, attended] = await Promise.all([
        base(),
        base().in('status_comercial', ['em_contato', 'qualificado']),
      ])
      if (all.error) throw all.error
      if (attended.error) throw attended.error
      return { cadastrados: all.count ?? 0, atendidos: attended.count ?? 0 }
    },
  })

  // O Dashboard já disponibiliza este mesmo resumo agregado aos admins que acessam a rota base.
  const financeQuery = useQuery({
    queryKey: ['admin-rel-finance', range.inicio, range.fim],
    enabled: Boolean(nivelAdmin),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_financeiro_resumo', {
        p_inicio: range.inicio, p_fim: range.fim, p_visao: 'competencia', p_fundo: null, p_partner: null, p_equipe: null,
      })
      if (error) throw error
      return data as Finance
    },
  })

  const analytics = analyticsQuery.data
  const propostas = propostasQuery.data ?? EMPTY_PROPOSTAS
  const leadCounts = leadsQuery.data
  const finance = financeQuery.data
  const monthly = useMemo(() => (analytics?.serie ?? []).map(row => ({
    m: new Date(`${row.periodo}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    volume: Math.round(Number(row.volume_solicitado) / 1_000_000),
    propostas: Number(row.propostas),
  })), [analytics?.serie])

  const produtos = useMemo(() => {
    const counts = new Map<string, number>()
    propostas.forEach(row => {
      const key = row.produto || 'outro'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    const total = propostas.length || 1
    return Array.from(counts.entries()).map(([key, count]) => ({
      name: PRODUTO_LABEL[key] ?? (key === 'outro' ? 'Outros' : key),
      value: Math.round((count / total) * 100),
      fill: PRODUTO_COLORS[key] ?? '#9CA3AF',
    }))
  }, [propostas])

  const ranking = useMemo(() => (analytics?.top_parceiros ?? []).slice(0, 5).map(row => ({
    p: row.partner_nome,
    v: Math.round(Number(row.volume_ganho) / 1_000_000),
  })), [analytics?.top_parceiros])

  const stages = useMemo(() => countProposalStages(propostas), [propostas])
  const stageCount = (status: string) => stages.find(stage => stage.status === status)?.quantidade ?? 0
  const cancelledCount = stageCount('cancelado')
  const draftCount = stageCount('simulacao')
  const standbyCount = stageCount('standby')
  const operationalCount = propostas.length - cancelledCount - draftCount - standbyCount
  const ticketMedio = analytics && analytics.ganhas > 0 ? Number(analytics.volume_ganho) / analytics.ganhas : 0
  const partnersTable = (analytics?.top_parceiros ?? []).slice(0, 20).map(row => ({
    nome: row.partner_nome,
    propostas: Number(row.total),
    aprovadas: Number(row.ganhas),
    volume: Number(row.volume_ganho),
    ticket: row.ganhas > 0 ? Number(row.volume_ganho) / row.ganhas : 0,
    conversao: row.total > 0 ? Math.round((row.ganhas / row.total) * 100) : 0,
  }))

  const loading = analyticsQuery.isLoading || propostasQuery.isLoading || leadsQuery.isLoading || financeQuery.isLoading
  const queryError = analyticsQuery.error || propostasQuery.error || leadsQuery.error || financeQuery.error
  const canExport = !loading && !queryError && Boolean(analytics && leadCounts && finance)
  const periodLabel = `${formatDate(range.inicio)} a ${formatDate(range.fim)}`
  const exportSections = useMemo(() => {
    if (!analytics || !leadCounts || !finance) return []
    return [
      { name: 'Resumo', rows: [
        ['Indicador', 'Valor'],
        ['Período', periodLabel],
        ['Propostas criadas', propostas.length],
        ['Propostas operacionais (exclui rascunhos, standby e canceladas)', operationalCount],
        ['Leads cadastrados/capturados', leadCounts.cadastrados],
        ['Leads atendidos (em contato ou qualificado)', leadCounts.atendidos],
        ['Taxa de conversão de propostas', `${analytics.taxa_conversao}%`],
        ['Volume ganho', Number(analytics.volume_ganho)],
        ['Ticket médio', ticketMedio],
      ] as ExportCell[][] },
      { name: 'Leads agregados', rows: [
        ['Métrica', 'Quantidade'],
        ['Capturas públicas cadastradas', leadCounts.cadastrados],
        ['Atendidas (em contato ou qualificado)', leadCounts.atendidos],
      ] as ExportCell[][] },
      { name: 'Propostas por etapa', rows: [
        ['Etapa atual', 'Quantidade'],
        ...stages.map(stage => [stage.etapa, stage.quantidade] as ExportCell[]),
        ['Total de propostas criadas no período', propostas.length],
      ] as ExportCell[][] },
      { name: 'Financeiro agregado', rows: [
        ['Indicador financeiro', 'Valor (R$)'],
        ['Entradas realizadas', Number(finance.entradas_realizadas)],
        ['Entradas previstas', Number(finance.entradas_previstas)],
        ['Saídas realizadas', Number(finance.saidas_realizadas)],
        ['Saídas previstas', Number(finance.saidas_previstas)],
        ['Custos operacionais realizados', Number(finance.custos_operacionais)],
        ['Custos de pessoal realizados', Number(finance.custos_pessoal)],
        ['Lançamentos previstos ou vencidos', Number(finance.pendencias)],
      ] as ExportCell[][] },
      { name: 'Parceiros', rows: [
        ['Parceiro', 'Propostas', 'Ganhas', 'Volume ganho (R$)', 'Ticket médio (R$)', 'Conversão'],
        ...partnersTable.map(row => [row.nome, row.propostas, row.aprovadas, row.volume, row.ticket, `${row.conversao}%`] as ExportCell[]),
      ] as ExportCell[][] },
      { name: 'Evolução mensal', rows: [
        ['Competência', 'Propostas', 'Volume solicitado (R$)', 'Volume ganho (R$)'],
        ...(analytics.serie ?? []).map(row => [
          new Date(`${row.periodo}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }),
          Number(row.propostas), Number(row.volume_solicitado), Number(row.volume_ganho),
        ] as ExportCell[]),
      ] as ExportCell[][] },
      { name: 'Distribuição por produto', rows: [
        ['Produto', 'Propostas', 'Participação'],
        ...produtos.map(product => [
          product.name,
          propostas.filter(row => (PRODUTO_LABEL[row.produto || 'outro'] ?? (row.produto ? row.produto : 'Outros')) === product.name).length,
          `${product.value}%`,
        ] as ExportCell[]),
      ] as ExportCell[][] },
    ]
  }, [analytics, finance, leadCounts, operationalCount, partnersTable, periodLabel, propostas, produtos, stages, ticketMedio])

  function exportExcel() {
    if (!canExport) return
    const filename = `relatorio-admin-${fileStamp(range.inicio)}-${fileStamp(range.fim)}.xls`
    downloadTextFile(filename, spreadsheetXml(exportSections), 'application/vnd.ms-excel;charset=utf-8')
    setExportNotice('Planilha Excel gerada com os mesmos filtros do relatório.')
  }

  function exportPdf() {
    if (!canExport) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setExportNotice('O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF.')
      return
    }
    const html = reportPrintHtml(
      'Relatório administrativo',
      periodLabel,
      new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      formatExportSheetsForPrint(exportSections),
      logoWide,
    )
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    setExportNotice('Relatório aberto para impressão ou salvamento em PDF.')
  }

  function changePreset(value: RelatorioPreset) {
    setPeriodo(value)
    setRangeFrom('')
    setRangeTo('')
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Relatórios</h1>
          <p className="text-sm text-silver-600">Análise consolidada de leads, propostas e financeiro.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="relative inline-flex items-center">
            <span className="sr-only">Período do relatório</span>
            <select
              className="h-10 w-[170px] appearance-none rounded-lg border border-navy/20 bg-white px-3 pr-9 text-sm font-semibold text-navy shadow-sm outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15 disabled:cursor-not-allowed disabled:bg-silver-50 disabled:text-silver-400"
              value={periodo}
              disabled={Boolean(rangeFrom || rangeTo)}
              onChange={event => changePreset(event.target.value as RelatorioPreset)}
            >
              <option value="12m">Últimos 12 meses</option>
              <option value="ytd">YTD</option>
              <option value="trimestre">Trimestre</option>
              <option value="mes">Mês atual</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 h-4 w-4 text-navy" />
          </label>
          <DateRangePicker
            start={range.inicio}
            end={range.fim}
            onChange={(start, end) => { setRangeFrom(start); setRangeTo(end) }}
          />
          {(rangeFrom || rangeTo) && (
            <button type="button" className="btn-no-liquid h-10 rounded-lg px-2 text-xs font-semibold text-silver-600 underline decoration-silver-300 underline-offset-2 transition hover:text-red-700" onClick={() => { setRangeFrom(''); setRangeTo('') }}>
              Limpar
            </button>
          )}
          <button type="button" className="btn-no-liquid btn-outline inline-flex h-10 items-center gap-2 border-silver-300 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={!canExport} onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button type="button" className="btn-no-liquid btn-gold inline-flex h-10 items-center gap-2 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={!canExport} onClick={exportPdf}>
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      <p className="mb-5 text-xs text-silver-500">Período considerado: {periodLabel}. As datas seguem o calendário de São Paulo.</p>
      {exportNotice && <div role="status" className="mb-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{exportNotice}</div>}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>
      ) : queryError ? (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Não foi possível carregar todos os dados do relatório. Confira as permissões e tente novamente.</div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Propostas no período" value={String(propostas.length)} intent="success" />
            <KPICard label="Volume ganho" value={money(analytics?.volume_ganho)} intent="gold" />
            <KPICard label="Ticket médio" value={money(ticketMedio)} />
            <KPICard label="Conversão de propostas" value={`${analytics?.taxa_conversao ?? 0}%`} />
          </div>

          <section className="mb-6" aria-labelledby="relatorio-leads-title">
            <h2 id="relatorio-leads-title" className="mb-3 font-semibold text-silver-900">Leads capturados no período</h2>
            <p className="mb-3 text-xs text-silver-500">Capturas mostradas em Leads / Simulações; atendidos são os registros atualmente em contato ou qualificados.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <KPICard label="Leads cadastrados / capturados" value={String(leadCounts?.cadastrados ?? 0)} intent="success" />
              <KPICard label="Leads atendidos" value={String(leadCounts?.atendidos ?? 0)} />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-silver-900">Volume mensal (R$ milhões) × Propostas</h2>
              {monthly.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
                    <XAxis dataKey="m" stroke="#9CA3AF" fontSize={12} />
                    <YAxis yAxisId="l" stroke="#0A2B4E" fontSize={12} />
                    <YAxis yAxisId="r" orientation="right" stroke="#D4AF37" fontSize={12} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="l" type="monotone" dataKey="volume" stroke="#D10000" strokeWidth={2.5} name="Volume (Mi)" />
                    <Line yAxisId="r" type="monotone" dataKey="propostas" stroke="#3A3A3A" strokeWidth={2.5} name="Propostas" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-silver-900">Distribuição por produto</h2>
              {produtos.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={produtos} dataKey="value" nameKey="name" outerRadius={100} label={(entry: { name: string; value: number }) => `${entry.name} ${entry.value}%`}>
                      {produtos.map((product, index) => <Cell key={index} fill={product.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-silver-900">Top 5 parceiros (volume R$ Mi)</h2>
              {ranking.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ranking} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#DEE2E6" />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={11} />
                    <YAxis type="category" dataKey="p" stroke="#9CA3AF" fontSize={11} width={120} />
                    <Tooltip /><Bar dataKey="v" fill="#D10000" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card overflow-hidden p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="font-semibold text-silver-900">Propostas por etapa</h2><p className="mt-1 text-xs text-silver-500">Etapa atual das propostas criadas no período · {propostas.length} no total</p></div>
                <span className="text-xs text-silver-500">{operationalCount} operacionais · {standbyCount} standby · {draftCount} rascunhos · {cancelledCount} canceladas</span>
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-silver-50 text-left text-xs uppercase text-silver-500"><tr><th className="px-3 py-2">Etapa</th><th className="px-3 py-2 text-right">Propostas</th></tr></thead>
                  <tbody>{stages.map(stage => <tr key={stage.status} className="border-t border-silver-100"><td className="px-3 py-2">{stage.etapa}</td><td className="px-3 py-2 text-right tabular-nums">{stage.quantidade}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-silver-500">Aliases legados foram somados à etapa canônica correspondente. “Outros status” reúne registros sem etapa conhecida.</p>
            </div>
          </div>

          <section className="card mt-6 p-5" aria-labelledby="relatorio-financeiro-title">
              <div className="mb-4"><h2 id="relatorio-financeiro-title" className="font-semibold text-silver-900">Financeiro por competência</h2><p className="mt-1 text-xs text-silver-500">Resumo agregado do módulo Financeiro; realizados e previstos ficam separados. O RPC considera competências mensais completas tocadas pelo período, mesmo se o filtro customizado cobrir parte do mês.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FinanceStat label="Entradas realizadas" value={money(finance?.entradas_realizadas)} />
              <FinanceStat label="Entradas previstas" value={money(finance?.entradas_previstas)} />
              <FinanceStat label="Saídas realizadas" value={money(finance?.saidas_realizadas)} />
              <FinanceStat label="Saídas previstas" value={money(finance?.saidas_previstas)} />
            </div>
            <p className="mt-3 text-xs text-silver-500">Também: custos operacionais {money(finance?.custos_operacionais)}, custos de pessoal {money(finance?.custos_pessoal)} e {Number(finance?.pendencias ?? 0)} lançamentos previstos ou vencidos.</p>
          </section>

          <div className="card mt-6 overflow-x-auto">
            <div className="px-4 pt-4"><h2 className="font-semibold text-silver-900">Parceiros no período</h2><p className="mt-1 text-xs text-silver-500">Até 10 parceiros retornados pela análise existente, ordenados pelo volume ganho.</p></div>
            <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500"><tr><th className="px-4 py-3">Parceiro</th><th className="px-4 py-3 text-right">Propostas</th><th className="px-4 py-3 text-right">Ganhas</th><th className="px-4 py-3 text-right">Volume</th><th className="px-4 py-3 text-right">Ticket médio</th><th className="px-4 py-3 text-right">Conversão</th></tr></thead>
              <tbody>{partnersTable.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-silver-400">Sem dados.</td></tr> : partnersTable.map(row => <tr key={row.nome} className="border-t border-silver-100"><td className="px-4 py-3 font-medium">{row.nome}</td><td className="px-4 py-3 text-right">{row.propostas}</td><td className="px-4 py-3 text-right text-success font-medium">{row.aprovadas}</td><td className="px-4 py-3 text-right font-bold text-navy">{money(row.volume)}</td><td className="px-4 py-3 text-right">{money(row.ticket)}</td><td className="px-4 py-3 text-right">{row.conversao}%</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function EmptyChart({ label = 'Sem dados no período.' }: { label?: string }) {
  return <p className="py-16 text-center text-sm text-silver-400">{label}</p>
}

function FinanceStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-silver-200 bg-white p-4"><p className="text-xs text-silver-500">{label}</p><strong className="mt-2 block text-lg text-navy tabular-nums">{value}</strong></div>
}

import { CircleHelp, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import './SerasaPFReport.css'

type Row = Record<string, unknown>
type SectionState = 'not_returned' | 'empty' | 'returned' | 'error'

function record(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null
}

function items(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is Row => item !== null) : []
}

function format(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('pt-BR').format(value)
  if (typeof value === 'string' && value.trim()) return value
  return '—'
}

function stateLabel(value: unknown): string {
  const state = value as SectionState
  if (state === 'returned') return 'Dados retornados pelo bureau'
  if (state === 'empty') return 'Lista vazia informada pelo bureau'
  if (state === 'error') return 'O bureau informou erro nesta seção'
  return 'Seção não retornada nesta consulta'
}

function Section({ title, status, children }: { title: string; status?: unknown; children: ReactNode }) {
  return <section className="serasa-report-section">
    <div className="serasa-report-section-heading"><h3>{title}</h3>{status !== undefined && <span>{stateLabel(status)}</span>}</div>
    {children}
  </section>
}

function DataGrid({ value, fields }: { value: Row | null; fields: Array<[string, string]> }) {
  const shown = fields.filter(([key]) => value?.[key] !== undefined && value[key] !== null && value[key] !== '')
  if (!shown.length) return <div className="serasa-report-empty"><CircleHelp size={16} />Nenhum campo retornado nesta seção.</div>
  return <dl className="serasa-report-data-grid">{shown.map(([key, label]) =>
    <div key={key}><dt>{label}</dt><dd>{format(value?.[key])}</dd></div>,
  )}</dl>
}

function StateMessage({ state }: { state: unknown }) {
  return <div className="serasa-report-empty"><CircleHelp size={16} />{stateLabel(state)}</div>
}

const negativeLabels: Record<string, string> = {
  pefin: 'Pefin', refin: 'Refin', collectionRecords: 'Registros de cobrança', check: 'Cheques', notary: 'Protestos',
}

export function SerasaPJReport({ report }: { report: unknown }) {
  const data = record(report)
  if (data?.legacy === true || data?.normalizerVersion !== 4) {
    return <div className="serasa-report"><StateMessage state="not_returned" /><p className="serasa-report-inline-detail">Este registro é anterior ao relatório PJ detalhado. Consulte o resumo original no histórico.</p></div>
  }

  const registration = record(data.registration)
  const negativeData = record(data.negativeData)
  const negativeSources = record(negativeData?.sources) ?? {}
  const negativeSummary = record(data.negativeSummary)
  const facts = record(data.facts)
  const inquiries = record(facts?.inquirySummary)
  const commercial = record(data.commercialPaymentHistory)
  const historicalChecks = record(data.checkFilingsHistorical)

  return <div className="serasa-report">
    <div className="serasa-report-banner">
      <div><span>RELATÓRIO PJ · {format(data.reportName)}</span><strong>{format(registration?.companyName)}</strong><small>Consulta {format(data.product)} · {format(data.consultedAt)}</small></div>
      <span className="serasa-report-source"><ShieldCheck size={15} /> Serasa Experian</span>
    </div>

    <div className="serasa-report-summary-grid">
      <article><span>Situação cadastral</span><strong>{format(registration?.statusRegistration)}</strong><small>{format(registration?.statusDate)}</small></article>
      <article><span>Apontamentos negativos</span><strong>{format(negativeSummary?.hasNegative)}</strong><small>{stateLabel(negativeSummary?.state)}</small></article>
      <article><span>Consultas no mês</span><strong>{format(inquiries?.currentMonth)}</strong><small>{inquiries?.currentMonthBanks == null ? 'Bancos não informados' : `${format(inquiries.currentMonthBanks)} bancos`}</small></article>
      <article><span>Fontes comerciais</span><strong>{format(record(commercial?.supplierSummary)?.sourcesTotal)}</strong><small>{stateLabel(commercial?.state)}</small></article>
      <article><span>Cheques históricos</span><strong>{format(historicalChecks?.recordsReturned)}</strong><small>{stateLabel(historicalChecks?.state)}</small></article>
    </div>

    <Section title="Identificação empresarial" status={registration?.state}>
      <DataGrid value={registration} fields={[
        ['companyName', 'Razão social'], ['companyAlias', 'Nome fantasia'], ['statusRegistration', 'Situação cadastral'],
        ['statusDate', 'Data da situação'], ['legalNatureCode', 'Natureza jurídica'], ['economicActivity', 'Atividade econômica'],
        ['cnae', 'CNAE'], ['companyFoundation', 'Data de abertura'], ['numberEmployees', 'Empregados'],
      ]} />
      {record(registration?.location) && <div className="serasa-report-subsection"><h4 className="serasa-report-subtitle">Localização</h4><DataGrid value={record(registration?.location)} fields={[
        ['city', 'Cidade'], ['state', 'UF'],
      ]} /></div>}
    </Section>

    <Section title="Apontamentos negativos" status={negativeData?.state}>
      <DataGrid value={negativeSummary} fields={[
        ['hasNegative', 'O bureau indica apontamentos'],
      ]} />
      <div className="serasa-report-subgrid">
        {Object.entries(negativeSources).map(([key, value]) => {
          const source = record(value)
          if (!source) return null
          return <div className="serasa-report-mini-grid" key={key}><article>
            <span>{negativeLabels[key] ?? key}</span>
            <strong>{source.count == null ? stateLabel(source.state) : `${format(source.count)} registro(s)`}</strong>
            {source.balance != null && <small>Saldo informado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(source.balance))}</small>}
          </article></div>
        })}
      </div>
      <div className="serasa-report-subsection">
        <h4 className="serasa-report-subtitle">Ações judiciais</h4>
        <DataGrid value={record(facts?.judgementFilings)} fields={[
          ['count', 'Quantidade informada'], ['balance', 'Saldo informado'],
        ]} />
        <h4 className="serasa-report-subtitle">Falências</h4>
        <DataGrid value={record(facts?.bankrupts)} fields={[
          ['count', 'Quantidade informada'], ['balance', 'Saldo informado'],
        ]} />
      </div>
    </Section>

    <Section title="Consultas à empresa" status={inquiries?.state}>
      <DataGrid value={inquiries} fields={[
        ['currentMonth', 'Consultas no mês'], ['currentMonthBanks', 'Consultas de bancos'],
      ]} />
      {items(inquiries?.historical).length > 0 && <div className="serasa-report-subsection">
        <h4 className="serasa-report-subtitle">Histórico mensal</h4>
        <div className="serasa-report-table-scroll"><table className="serasa-report-table"><thead><tr><th>Mês</th><th>Consultas</th><th>Bancos</th></tr></thead><tbody>
          {items(inquiries?.historical).map((row, index) => <tr key={`${format(row.inquiryDate)}-${index}`}><td>{format(row.inquiryDate)}</td><td>{format(row.occurrences)}</td><td>{format(row.bankOccurrences)}</td></tr>)}
        </tbody></table></div>
      </div>}
    </Section>

    <Section title="Histórico de pagamentos comerciais" status={commercial?.state}>
      {commercial?.state === 'returned' ? <>
        <DataGrid value={record(commercial?.paymentTotal)} fields={[
          ['periodDescription', 'Período'], ['totalValueRangeDescription', 'Faixa de valores totais'], ['averageValueRangeDescription', 'Faixa de valores médios'],
        ]} />
        <div className="serasa-report-subgrid">
          <DataGrid value={record(commercial?.delaySummary)} fields={[
            ['averageDelayDaysFrom', 'Atraso médio a partir de (dias)'], ['averageDelayDaysTo', 'Atraso médio até (dias)'],
          ]} />
          <DataGrid value={record(commercial?.supplierSummary)} fields={[
            ['sourcesTotal', 'Fontes de relacionamento'], ['paymentHistorySources', 'Fontes de histórico'],
            ['paymentHistoryValuesSources', 'Fontes com valores'], ['evolutionCommitmentsSources', 'Fontes de compromissos'],
          ]} />
        </div>
        <div className="serasa-report-subsection"><h4 className="serasa-report-subtitle">Faixas de compromissos</h4><DataGrid value={record(commercial?.commitmentTotal)} fields={[
          ['periodDescription', 'Período'], ['overdueTotalRangeDescription', 'Faixa vencida'], ['upcomingValueRangeDescription', 'Faixa a vencer'],
        ]} /></div>
      </> : <StateMessage state={commercial?.state} />}
    </Section>

    <Section title="Cheques históricos" status={historicalChecks?.state}>
      {historicalChecks?.state === 'returned' ? <DataGrid value={historicalChecks} fields={[
        ['recordsReturned', 'Faixas de registros retornadas'], ['quantityChecks', 'Quantidade agregada de cheques'],
      ]} /> : <StateMessage state={historicalChecks?.state} />}
    </Section>

    <p className="serasa-report-disclaimer"><ShieldCheck size={14} /> Relatório informativo baseado nos dados retornados pela Serasa Experian. A ausência de uma seção não representa resultado negativo ou aprovação de crédito.</p>
  </div>
}

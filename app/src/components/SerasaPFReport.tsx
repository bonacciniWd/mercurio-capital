import { AlertTriangle, CheckCircle2, CircleHelp, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import './SerasaPFReport.css'

type Row = Record<string, unknown>

function record(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Row
    : null
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is Row => !!item) : []
}

function uniqueContactRows(value: unknown, identityFields: string[]): Row[] {
  const unique = new Map<string, Row>()
  for (const item of rows(value)) {
    const identity = identityFields
      .map((field) => String(item[field] ?? '').trim().toLocaleLowerCase('pt-BR'))
      .join('|')
    if (!identity.split('|').join('')) {
      unique.set(`contact-${unique.size}`, item)
      continue
    }
    const existing = unique.get(identity)
    if (existing) {
      unique.set(identity, { ...item, ...existing })
    } else {
      unique.set(identity, item)
    }
  }
  return [...unique.values()]
}

function display(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('pt-BR').format(value)
  if (typeof value === 'string' && value.trim()) return value
  return '—'
}

function money(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : '—'
}

function Section({ title, children, status }: { title: string; children: ReactNode; status?: string }) {
  return <section className="serasa-report-section">
    <div className="serasa-report-section-heading"><h3>{title}</h3>{status && <span>{status}</span>}</div>
    {children}
  </section>
}

function DataGrid({ value, fields }: { value: Row | null; fields: Array<[string, string]> }) {
  if (!value) return <EmptyState label="Dados não retornados nesta consulta." />
  const shown = fields.filter(([key]) => value[key] !== undefined && value[key] !== null && value[key] !== '')
  return shown.length ? <dl className="serasa-report-data-grid">{shown.map(([key, label]) =>
    <div key={key}><dt>{label}</dt><dd>{display(value[key])}</dd></div>,
  )}</dl> : <EmptyState label="Dados não retornados nesta consulta." />
}

function EmptyState({ label }: { label: string }) {
  return <div className="serasa-report-empty"><CircleHelp size={16} />{label}</div>
}

function DataTable({ value, fields, empty = 'Nenhum registro retornado.' }: {
  value: unknown
  fields: Array<[string, string, 'money'?]>
  empty?: string
}) {
  const items = rows(value)
  if (!items.length) return <EmptyState label={empty} />
  return <div className="serasa-report-table-scroll"><table className="serasa-report-table">
    <thead><tr>{fields.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{items.map((item, index) => <tr key={index}>{fields.map(([key, label, format]) =>
      <td key={label}>{format === 'money' ? money(item[key]) : display(item[key])}</td>,
    )}</tr>)}</tbody>
  </table></div>
}

const negativeLabels: Record<string, string> = {
  pefin: 'Pefin · pendências comerciais',
  refin: 'Refin · restrições financeiras',
  notary: 'Protestos',
  check: 'Cheques sem fundos',
  collectionRecords: 'Dívidas vencidas',
  spcNegative: 'Apontamentos SPC',
}

export function SerasaPFReport({ report }: { report: unknown }) {
  const data = record(report)
  if (!data || data.normalizerVersion !== 3) return <EmptyState label="O histórico desta consulta contém apenas o resumo anterior; os detalhes não foram armazenados." />
  const registration = record(data.registration)
  const negativeData = record(data.negativeData)
  const sources = record(negativeData?.sources) ?? {}
  const score = record(data.score)
  const flag = record(data.negativeFlag)
  const facts = record(data.facts)
  const inquiry = record(facts?.inquirySummary)
  const monthly = rows(inquiry?.monthlyCreditInquiries)
  const partnership = record(data.partner)
  const income = record(facts?.income)
  const incomeValues = record(income?.values)
  const optional = record(data.optionalFeatures)
  const requestedFeatures = Array.isArray(optional?.requested) ? optional.requested.map(display) : []
  const returnedFeatures = Array.isArray(optional?.returnedSections) ? optional.returnedSections.map(display) : []
  const individual = [
    ['consumerName', 'Nome'], ['documentNumber', 'CPF'], ['birthDate', 'Nascimento'],
    ['motherName', 'Nome da mãe'], ['consumerGenderDescription', 'Sexo'],
    ['maritalStatusDescription', 'Estado civil'], ['birthSquareCity', 'Naturalidade'],
    ['birthSquareState', 'UF de nascimento'], ['profession', 'Profissão'],
    ['jobDescription', 'Ocupação'], ['educationLevelDescription', 'Escolaridade'],
    ['dependentsNumber', 'Dependentes'], ['statusRegistration', 'Situação cadastral'],
    ['statusDate', 'Atualização cadastral'], ['socialName', 'Nome social'],
    ['corporateCompanyName', 'Empresa informada'], ['corporateCompanyDocumentNumber', 'CNPJ da empresa'],
  ] as Array<[string, string]>
  const locations = uniqueContactRows([
    ...(registration?.address ? [registration.address] : []),
    ...rows(registration?.addresses),
  ], ['addressLine', 'addressNumber', 'zipCode', 'city', 'state'])
  const phones = uniqueContactRows([
    ...(registration?.phone ? [registration.phone] : []),
    ...rows(registration?.phones),
  ], ['regionCode', 'areaCode', 'phoneNumber'])
  const emails = uniqueContactRows(rows(registration?.emails).map((email) => ({
    email: email.email ?? email.emailAddress,
    updateDate: email.updateDate,
  })), ['email'])

  return <div className="serasa-report">
    <div className="serasa-report-banner">
      <div><span>RELATÓRIO PF · {display(data.reportName)}</span><strong>{display(registration?.consumerName)}</strong><small>Consulta {display(data.product)} · {display(data.consultedAt)}</small></div>
      <span className="serasa-report-source"><ShieldCheck size={15} /> Serasa Experian</span>
    </div>

    <div className="serasa-report-summary-grid">
      <article><span>Situação cadastral</span><strong>{display(registration?.statusRegistration)}</strong><small>{display(registration?.statusDate)}</small></article>
      <article className="serasa-report-score"><span>Score de crédito</span><strong>{display(score?.value)}</strong><small>{score?.model ? `Modelo ${display(score.model)}` : display(score?.calculation)}</small></article>
      <article><span>Apontamentos negativos</span><strong>{display(flag?.count)}</strong><small>{flag?.balance !== undefined ? money(flag.balance) : display(flag?.hasNegative)}</small></article>
      <article><span>Participações societárias</span><strong>{display(partnership?.count)}</strong><small>registros retornados</small></article>
      <article><span>Consultas no mês</span><strong>{display(inquiry?.currentMonth)}</strong><small>{display(inquiry?.currentMonthBanks)} bancos · {display(inquiry?.currentMonthCompanies)} empresas</small></article>
    </div>

    <Section title="Identificação cadastral" status={registration?.available === true ? 'Retorno do bureau' : registration ? 'Dados parciais do bureau' : 'Não retornada'}>
      <DataGrid value={registration} fields={individual} />
      <div className="serasa-report-subgrid">
        <div><h4>Endereços informados</h4><DataTable value={locations} fields={[
          ['addressTypeDescription', 'Tipo'], ['addressLine', 'Logradouro'], ['addressNumber', 'Número'],
          ['addressComplement', 'Complemento'], ['district', 'Bairro'], ['zipCode', 'CEP'],
          ['city', 'Cidade'], ['state', 'UF'], ['updateDate', 'Atualizado'],
        ]} empty="Nenhum endereço retornado." /></div>
        <div><h4>Telefones informados</h4><DataTable value={phones} fields={[
          ['regionCode', 'DDI'], ['areaCode', 'DDD'], ['phoneNumber', 'Telefone'], ['phoneType', 'Tipo'], ['updateDate', 'Atualizado'],
        ]} empty="Nenhum telefone retornado." />
          <h4 className="serasa-report-contact-heading">E-mails informados</h4>
          <DataTable value={emails} fields={[
            ['email', 'E-mail'], ['updateDate', 'Atualizado'],
          ]} empty="Nenhum e-mail retornado." />
        </div>
      </div>
    </Section>

    <Section title="Score de crédito" status={score ? `Modelo ${display(score.model)}` : 'Não retornado'}>
      {score ? <div className="serasa-report-score-detail">
        <div className="serasa-report-score-number"><strong>{display(score.value)}</strong><span>de acordo com a faixa fornecida pelo provedor</span></div>
        <DataGrid value={score} fields={[
          ['range', 'Faixa'], ['defaultRate', 'Probabilidade de inadimplência'],
          ['message', 'Interpretação do modelo'], ['codeMessage', 'Código da mensagem'],
        ]} />
      </div> : <EmptyState label="Score não retornado neste relatório. Features adicionais dependem da configuração e do contrato Serasa." />}
      {score && <p className="serasa-report-note"><AlertTriangle size={14} /> A taxa exibida mantém o significado informado pela Serasa. Ela não representa probabilidade de pagamento.</p>}
    </Section>

    <Section title="Apontamentos negativos" status={flag?.hasNegative === false ? 'Sem apontamentos indicados pelo provedor' : flag?.hasNegative === true ? 'Há apontamentos' : 'Resultado não informado'}>
      <div className="serasa-report-mini-grid"><article><span>Total informado</span><strong>{display(flag?.count)}</strong></article><article><span>Saldo total informado</span><strong>{money(flag?.balance)}</strong></article></div>
      {Object.entries(sources).map(([key, value]) => {
        const section = record(value)
        if (!section) return null
        return <div className="serasa-report-subsection" key={key}>
          <div className="serasa-report-subsection-heading"><h4>{negativeLabels[key] ?? key}</h4><span>{section.count === null ? 'Total não informado' : `${display(section.count)} registro(s)`} · {money(section.balance)}</span></div>
          {section.message !== undefined && section.message !== null && <p className="serasa-report-inline-detail">{display(section.message)}</p>}
          <DataTable value={section.records} fields={[
            ['occurrenceDate', 'Ocorrência'], ['inclusionDate', 'Inclusão'], ['availabilityDate', 'Disponível'],
            ['legalNature', 'Natureza'], ['creditorName', 'Credor'], ['creditorBusinessDocument', 'Documento do credor'],
            ['contractId', 'Contrato'], ['bank', 'Banco'], ['amount', 'Valor', 'money'], ['city', 'Cidade'],
            ['federalUnit', 'UF'], ['legalSquare', 'Praça'], ['principal', 'Titular / avalista'], ['flagSubJudice', 'Sub judice'],
          ]} empty={section.available ? 'Nenhuma ocorrência detalhada retornada.' : 'Bloco não retornado.'} />
          {section.truncated === true && <p className="serasa-report-note">Lista limitada aos primeiros 100 registros. Totais são os informados pela Serasa.</p>}
        </div>
      })}
      <div className="serasa-report-subsection"><h4>Cheques sem fundos</h4><DataTable value={negativeData?.checks && record(negativeData.checks)?.records} fields={[
        ['occurrenceDate', 'Ocorrência'], ['bankName', 'Banco'], ['agencyNumber', 'Agência'], ['checkNumber', 'Cheque'],
        ['alinea', 'Alínea'], ['checkCount', 'Quantidade'], ['city', 'Cidade'], ['federalUnit', 'UF'], ['principal', 'Titular / avalista'],
      ]} /></div>
    </Section>

    <Section title="Participações societárias" status={partnership ? `${display(partnership.count)} registro(s)` : 'Não retornadas'}>
      <DataTable value={partnership?.items} fields={[
        ['companyName', 'Empresa'], ['businessDocument', 'CNPJ'], ['participationType', 'Participação'],
        ['participationPercentage', 'Percentual'], ['sinceDate', 'Desde'], ['companyStatus', 'Situação'],
        ['companyStatusDate', 'Data da situação'], ['companyState', 'UF'], ['updateDate', 'Atualizado'], ['hasNegative', 'Apontamento'],
      ]} empty={partnership ? 'Nenhuma participação retornada.' : 'Bloco de participações não retornado.'} />
    </Section>

    <Section title="Documentos roubados, furtados ou extraviados">
      {facts?.stolenDocuments ? <DataTable value={record(facts.stolenDocuments)?.records} fields={[
        ['documentType', 'Tipo'], ['occurrenceDate', 'Ocorrência'], ['inclusionDate', 'Inclusão'],
        ['issuingAuthority', 'Órgão emissor'], ['detailedReason', 'Motivo'], ['occurrenceState', 'UF'],
      ]} empty="Nenhum registro detalhado retornado." /> : <EmptyState label="Bloco não retornado nesta consulta." />}
    </Section>

    <Section title="Consultas ao crédito" status={inquiry?.currentMonth !== null && inquiry?.currentMonth !== undefined ? `${display(inquiry.currentMonth)} no mês atual` : 'Totais não informados'}>
      {monthly.length ? <div className="serasa-report-month-chart" role="img" aria-label="Quantidade mensal de consultas de crédito">
        {monthly.slice(0, 12).reverse().map((item, index) => {
          const amount = typeof item.occurrences === 'number' ? item.occurrences : 0
          const max = Math.max(1, ...monthly.map(row => typeof row.occurrences === 'number' ? row.occurrences : 0))
          return <div className="serasa-report-month-column" key={`${display(item.month)}-${index}`} title={`${display(item.month)}: ${display(item.occurrences)}`}>
            <strong>{display(item.occurrences)}</strong><i style={{ height: `${Math.max(4, amount / max * 100)}%` }} /><span>{display(item.month)}</span>
          </div>
        })}
      </div> : <EmptyState label="Histórico mensal não retornado." />}
      <DataGrid value={inquiry} fields={[
        ['currentMonth', 'Consultas no mês'], ['currentMonthBanks', 'Bancos'], ['currentMonthCompanies', 'Empresas'], ['currentMonthChecks', 'Cheques'],
      ]} />
      <DataTable value={monthly} fields={[
        ['month', 'Mês'], ['occurrences', 'Consultas'], ['bankOccurrences', 'Bancos'], ['companyOccurrences', 'Empresas'],
      ]} empty="Detalhamento mensal não retornado." />
      <DataTable value={record(facts?.inquiries)?.records} fields={[
        ['occurrenceDate', 'Data'], ['segmentDescription', 'Segmento'], ['daysQuantity', 'Dias desde a última consulta'],
      ]} empty="Detalhamento por data/segmento não retornado." />
    </Section>

    <Section title="Ações judiciais e falências">
      <h4 className="serasa-report-subtitle">Ações judiciais</h4>
      <DataTable value={record(facts?.judgementFilings)?.records} fields={[
        ['occurrenceDate', 'Data'], ['legalNature', 'Natureza'], ['caseNumber', 'Processo'], ['civilCourt', 'Foro'],
        ['amount', 'Valor', 'money'], ['city', 'Cidade'], ['state', 'UF'], ['principal', 'Titular / avalista'],
      ]} empty="Nenhuma ação detalhada retornada." />
      <h4 className="serasa-report-subtitle">Participação em falência</h4>
      <DataTable value={record(facts?.bankrupts)?.records} fields={[
        ['occurrenceDate', 'Data'], ['companyName', 'Empresa'], ['companyDocumentId', 'CNPJ'], ['positionCompany', 'Vínculo'],
        ['legalNature', 'Natureza'], ['caseNumber', 'Processo'], ['city', 'Cidade'], ['state', 'UF'],
      ]} empty="Nenhum registro de falência detalhado retornado." />
    </Section>

    <Section title="Cheques sustados e históricos">
      <DataTable value={record(data.checkFilingsHistorical)?.items} fields={[
        ['bankName', 'Banco'], ['bankNumber', 'Código'], ['agencyNumber', 'Agência'], ['initialCheckNumber', 'Cheque inicial'],
        ['finalCheckNumber', 'Cheque final'], ['quantityCheck', 'Quantidade'], ['checkAmount', 'Valor', 'money'],
        ['briefDescriptionReason', 'Motivo'], ['dateTimeInclusion', 'Inclusão'],
      ]} empty="Nenhum registro histórico de cheque retornado." />
    </Section>

    <Section title="Renda e capacidade de pagamento" status={income ? `Feature ${display(income.featureName)}` : 'Feature não retornada'}>
      {income ? <>
        <DataGrid value={incomeValues} fields={[
          ['income', 'Renda estimada'], ['paymentCapacity', 'Capacidade de pagamento'], ['incomeCommitment', 'Comprometimento de renda'],
        ]} />
        <DataTable value={income.sources} fields={[
          ['sourceCode', 'Código da fonte'], ['sourceDescription', 'Origem da renda'],
        ]} empty="Origem da renda não informada." />
        <DataTable value={income.attributes} fields={[
          ['attributeModel', 'Modelo'], ['scoring', 'Resultado'], ['range', 'Faixa'], ['message', 'Mensagem'], ['codeMessage', 'Código'],
        ]} empty="Atributos adicionais de renda não retornados." />
      </> : <EmptyState label="Renda Mais/HRM5 ainda não foi habilitada para esta consulta ou não veio na resposta." />}
    </Section>

    {(requestedFeatures.length > 0 || returnedFeatures.length > 0) && <Section title="Features adicionais">
      <DataGrid value={{ requested: requestedFeatures.join(', '), returned: returnedFeatures.join(', ') }} fields={[
        ['requested', 'Solicitadas nesta consulta'], ['returned', 'Seções retornadas pelo provedor'],
      ]} />
    </Section>}

    <p className="serasa-report-disclaimer"><CheckCircle2 size={14} /> Dados históricos retornados pelo provedor na data da consulta. Este relatório auxilia a análise e não constitui decisão automática de crédito.</p>
  </div>
}

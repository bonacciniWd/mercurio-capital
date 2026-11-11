export type SerasaEnv = 'uat' | 'producao'
export type SerasaProduct = 'RELATORIO_AVANCADO_PF' | 'RELATORIO_AVANCADO_PJ_ANALITICO'

const URLS: Record<SerasaEnv, string> = {
  uat: 'https://uat-api.serasaexperian.com.br',
  producao: 'https://api.serasaexperian.com.br',
}

export function serasaEnvironment(configuredUrl: string): SerasaEnv | null {
  const normalized = configuredUrl.replace(/\/+$/, '')
  if (normalized === URLS.uat) return 'uat'
  if (normalized === URLS.producao) return 'producao'
  return null
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function firstObject(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    const result = object(value)
    if (result) return result
  }
  return null
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function extractRefinOccurrences(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const occurrence = object(item)
    if (!occurrence) return []
    const legalNatureId = firstText(occurrence.legalNatureId)
    const legalNature = firstText(occurrence.legalNature)
    const occurrenceDate = firstText(occurrence.occurrenceDate)
    if (!legalNatureId && !legalNature && !occurrenceDate) return []
    return [{ legalNatureId, legalNature, occurrenceDate }]
  })
}

function extractScore(report: Record<string, unknown>): Record<string, unknown> | null {
  const scores = object(report.scores)
  const scoreValue = report.score ?? scores?.scoreResponse ?? report.scoreResponse
  const score = firstObject(Array.isArray(scoreValue) ? scoreValue[0] : scoreValue)
  if (!score) return null
  return {
    value: finiteNumber(score.score),
    model: firstText(score.scoreModel),
    range: firstText(score.range),
    defaultRate: firstText(score.defaultRate),
    codeMessage: finiteNumber(score.codeMessage),
    message: firstText(score.message),
    features: object(score.features),
    calculation: finiteNumber(score.score) === null ? 'sem_calculo' : 'calculado',
  }
}

function extractNegativeOverview(value: unknown): Record<string, unknown> | null {
  const block = object(value)
  if (!block) return null
  const rows = Array.isArray(block.summaries) ? block.summaries : []
  return {
    hasNegative: typeof block.hasNegative === 'boolean' ? block.hasNegative : null,
    summaryCount: rows.length,
    summaries: rows.flatMap((item) => {
      const row = object(item)
      if (!row) return []
      return [{
        negativeType: firstText(row.negativeType),
        newestNegativeDate: firstText(row.newestNegativeDate),
        oldestNegativeDate: firstText(row.oldestNegativeDate),
        count: finiteNumber(row.count),
        balance: finiteNumber(row.balance),
      }]
    }),
  }
}

function extractFacts(value: unknown): Record<string, unknown> | null {
  const facts = object(value)
  if (!facts) return null
  const inquirySummary = object(facts.inquirySummary)
  const inquiryQuantity = object(inquirySummary?.inquiryQuantity)
  const monthly = Array.isArray(inquiryQuantity?.creditInquiriesQuantity)
    ? inquiryQuantity.creditInquiriesQuantity
    : []
  const monthlyCreditInquiries = monthly.flatMap((item) => {
    const row = object(item)
    if (!row) return []
    return [{
      month: firstText(row.inquiryDate),
      occurrences: finiteNumber(row.occurrences),
      bankOccurrences: finiteNumber(row.bankOccurrences),
      companyOccurrences: finiteNumber(row.companyOccurrences),
    }]
  })
  return {
    inquirySummary: inquiryQuantity ? {
      currentMonth: finiteNumber(inquiryQuantity.actual),
      currentMonthChecks: finiteNumber(inquiryQuantity.checkActual),
      currentMonthBanks: finiteNumber(inquiryQuantity.bankActual),
      currentMonthCompanies: finiteNumber(inquiryQuantity.companyActual),
      monthlyCreditInquiries,
    } : null,
    // The detailed fact blocks can contain document numbers, phone numbers,
    // names and other identifiers. Keep only presence/count metadata here.
    availableBlocks: Object.keys(facts).filter((key) => facts[key] !== null && facts[key] !== undefined),
  }
}

function extractPartnerships(value: unknown): Record<string, unknown> | null {
  const block = object(value)
  if (!block) return null
  const rawRows = block.partnershipResponse
  const rows = Array.isArray(rawRows) ? rawRows : []
  return {
    count: rows.length,
    items: rows.flatMap((item) => {
      const row = object(item)
      if (!row) return []
      return [{
        companyName: firstText(row.companyName),
        participationType: firstText(row.participationType),
        participationPercentage: finiteNumber(row.participationPercentage),
        companyStatus: firstText(row.companyStatus),
        companyState: firstText(row.companyState),
        sinceDate: firstText(row.sinceDate),
      }]
    }),
  }
}

function extractHistoricalChecks(value: unknown): Record<string, unknown> | null {
  const block = object(value)
  if (!block) return null
  const rawRows = block.checkFilingsHistoricalResponse
  const rows = Array.isArray(rawRows) ? rawRows : []
  let quantity = 0
  let amount = 0
  let hasQuantity = false
  let hasAmount = false
  for (const item of rows) {
    const row = object(item)
    if (!row) continue
    const rowQuantity = finiteNumber(row.quantityCheck)
    const rowAmount = finiteNumber(row.checkAmount)
    if (rowQuantity !== null) { quantity += rowQuantity; hasQuantity = true }
    if (rowAmount !== null) { amount += rowAmount; hasAmount = true }
  }
  return {
    records: rows.length,
    quantityChecks: hasQuantity ? quantity : null,
    amount: hasAmount ? amount : null,
  }
}

function extractNegativeSummary(report: Record<string, unknown>): Record<string, unknown> {
  const negativeData = object(report.negativeData)
  const output: Record<string, unknown> = {}
  for (const key of ['pefin', 'refin', 'notary', 'check', 'collectionRecords', 'spcNegative'] as const) {
    const block = object(negativeData?.[key])
    if (!block) continue
    const response = firstObject(block[`${key}Response`], block.response, block) ?? {}
    const summary = firstObject(response.summary, block.summary) ?? response
    const count = finiteNumber(summary.count) ?? finiteNumber(summary.quantity)
    const balance = finiteNumber(summary.balance)
    const result: Record<string, unknown> = {
      available: true,
      count,
      balance,
      calculation: count === null && balance === null ? 'sem_total_normalizado' : 'disponivel',
    }
    if (key === 'refin') {
      result.occurrences = extractRefinOccurrences(
        Array.isArray(block.refinResponse) ? block.refinResponse : response.refinResponse,
      )
    }
    output[key] = result
  }
  return { available: negativeData !== null, sources: output }
}

export function normalizeSerasaReport(
  raw: Record<string, unknown>,
  product: SerasaProduct,
  reportVersion: string,
): Record<string, unknown> {
  const reports = Array.isArray(raw.reports) ? raw.reports : []
  const report = firstObject(reports[0], raw.report, raw) ?? {}
  const score = extractScore(report)
  const identity = firstObject(report.registration, report.identificationReport)
  return {
    source: 'serasa_experian',
    product,
    version: reportVersion,
    reportName: firstText(report.reportName, raw.reportName, product),
    identityAvailable: identity !== null,
    score,
    negativeData: extractNegativeSummary(report),
    negativeSummary: extractNegativeOverview(report.negativeSummary),
    facts: extractFacts(report.facts),
    partner: extractPartnerships(report.partner),
    checkFilingsHistorical: extractHistoricalChecks(report.checkFilingsHistorical),
    normalizerVersion: 2,
    availableSections: Object.keys(report).filter((key) => !['registration', 'identificationReport'].includes(key)),
    consultedAt: new Date().toISOString(),
  }
}

export function serasaDocumentHeader(document: string): string {
  const digits = document.replace(/\D/g, '')
  if (digits.length !== 11 && digits.length !== 14) throw new Error('documento_invalido')
  return digits
}

export async function requestSerasaReport(args: {
  apiUrl: string
  clientId: string
  clientSecret: string
  document: string
  retailerDocumentId?: string
  product: SerasaProduct
  reportParameters?: Record<string, unknown>
  signal?: AbortSignal
}): Promise<Record<string, unknown>> {
  const env = serasaEnvironment(args.apiUrl)
  if (!env) throw new Error('serasa_url_ambiente_invalida')
  const base = URLS[env]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  const relayAbort = () => controller.abort()
  args.signal?.addEventListener('abort', relayAbort, { once: true })
  try {
    const authorization = btoa(`${args.clientId}:${args.clientSecret}`)
    const login = await fetch(`${base}/security/iam/v1/client-identities/login`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      redirect: 'error',
    })
    if (!login.ok) throw new Error(`serasa_auth_${login.status}`)
    const authPayload = await login.json() as { accessToken?: string }
    if (!authPayload.accessToken) throw new Error('serasa_token_ausente')

    const isPf = args.product === 'RELATORIO_AVANCADO_PF'
    const document = serasaDocumentHeader(args.document)
    if ((isPf && document.length !== 11) || (!isPf && document.length !== 14)) {
      throw new Error('documento_tipo_invalido')
    }
    const retailerDocumentId = args.retailerDocumentId?.replace(/\D/g, '')
    if (env === 'producao' && (!retailerDocumentId || retailerDocumentId.length !== 14)) {
      throw new Error('serasa_cnpj_consultante_ausente')
    }
    const endpoint = new URL(isPf
      ? '/credit-services/person-information-report/v1/creditreport'
      : '/credit-services/business-information-report/v1/reports', base)
    endpoint.searchParams.set('reportName', args.product)
    if (args.reportParameters) {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(args.reportParameters))))
      endpoint.searchParams.set('reportParameters', encoded)
    }
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authPayload.accessToken}`,
        'X-Document-Id': document,
        ...(retailerDocumentId ? { 'X-Retailer-Document-Id': retailerDocumentId } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
      redirect: 'error',
    })
    if (!response.ok) throw new Error(`serasa_report_${response.status}`)
    const payload = await response.json()
    const parsed = object(payload)
    if (!parsed) throw new Error('serasa_resposta_invalida')
    return parsed
  } finally {
    clearTimeout(timeout)
    args.signal?.removeEventListener('abort', relayAbort)
  }
}

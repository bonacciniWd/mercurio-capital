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

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return value === null || value === undefined ? [] : [value]
}

function projectFields(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const projected: Record<string, unknown> = {}
  for (const field of fields) {
    const item = source[field]
    if (typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) {
      projected[field] = item
    }
  }
  return projected
}

function projectRows(value: unknown, fields: readonly string[], limit = 100): Record<string, unknown>[] {
  return list(value).slice(0, limit).flatMap((item) => {
    const row = projectFields(item, fields)
    return row && Object.keys(row).length ? [row] : []
  })
}

const ADDRESS_FIELDS = ['addressLine', 'addressTypeDescription', 'addressNumber', 'district', 'zipCode', 'country', 'city', 'state', 'addressComplement', 'updateDate'] as const
const PHONE_FIELDS = ['regionCode', 'areaCode', 'phoneNumber', 'phoneType', 'updateDate'] as const
const NEGATIVE_FIELDS = ['occurrenceDate', 'inclusionDate', 'availabilityDate', 'legalNatureId', 'legalNature', 'contractId', 'creditorName', 'creditorBusinessDocument', 'amount', 'balance', 'bank', 'city', 'federalUnit', 'legalSquare', 'principal', 'flagSubJudice', 'dispute'] as const

function extractRegistration(value: unknown, localizationValue?: unknown): Record<string, unknown> | null {
  const registration = object(value)
  const localization = object(localizationValue)
  if (!registration && !localization) return null
  const source = registration ?? {}
  const result = projectFields(source, [
    'documentNumber', 'consumerName', 'motherName', 'consumerGender', 'consumerGenderDescription',
    'maritalStatusDescription', 'birthDate', 'birthSquareCity', 'birthSquareState', 'profession',
    'jobDescription', 'occupation', 'educationLevelDescription', 'dependentsNumber', 'statusRegistration',
    'statusRegistrationCode', 'statusDate', 'socialName', 'corporateCompanyName', 'corporateCompanyDocumentNumber',
    'sourceInformationDescription',
  ]) ?? {}
  const address = projectFields(source.address ?? localization?.address, ADDRESS_FIELDS)
  const addresses = projectRows(source.addresses ?? localization?.addresses, ADDRESS_FIELDS, 20)
  const phone = projectFields(source.phone ?? localization?.phone, PHONE_FIELDS)
  const phones = projectRows(source.phones ?? localization?.phones, PHONE_FIELDS, 20)
  const emails = projectRows(source.emails, ['email', 'emailAddress', 'updateDate'], 10)
  if (address) result.address = address
  if (addresses.length) result.addresses = addresses
  if (phone) result.phone = phone
  if (phones.length) result.phones = phones
  if (emails.length) result.emails = emails
  const status = firstText(source.statusRegistration, source.statusRegistrationCode)
  return { ...result, available: !!registration, source: 'serasa', statusAvailable: !!status }
}

function extractOccurrences(block: unknown, responseKey: string, fields: readonly string[]): Record<string, unknown> | null {
  const source = object(block)
  if (!source) return null
  const nested = object(source[responseKey])
  const response = nested ?? source
  const summary = object(response.summary) ?? object(source.summary)
    ?? (finiteNumber(response.count) !== null || finiteNumber(response.quantity) !== null || finiteNumber(response.balance) !== null ? response : null)
  const rows = response[responseKey]
  const arrayRows = Array.isArray(rows) ? rows : []
  return {
    available: true,
    count: finiteNumber(summary?.count) ?? finiteNumber(summary?.quantity),
    balance: finiteNumber(summary?.balance),
    firstOccurrence: firstText(summary?.firstOccurrence),
    lastOccurrence: firstText(summary?.lastOccurrence),
    message: firstText(summary?.message),
    records: projectRows(arrayRows, fields),
    recordsReturned: arrayRows.length,
    truncated: arrayRows.length > 100,
    error: firstText(object(source.error)?.message, object(response.error)?.message),
  }
}

function extractOptionalFeatureSections(value: unknown, requested: string[]): Record<string, unknown> {
  const source = object(value) ?? {}
  const documented = new Set(['registration', 'localization', 'negativeData', 'score', 'scores', 'facts', 'partner', 'checkFilingsHistorical', 'attributes'])
  return {
    requested,
    returnedSections: Object.keys(source).filter((key) => documented.has(key)),
    attributes: extractAttributes(source.attributes),
  }
}

function extractAttributes(value: unknown, scoreFeaturesValue?: unknown): Record<string, unknown> | null {
  const attributes = object(value)
  const scoreFeatures = object(scoreFeaturesValue)
  if (!attributes && !scoreFeatures) return null
  const source = attributes ?? {}
  const responseRows = projectRows(source.attributesResponse, ['scoring', 'attributeModel', 'codeMessage', 'message', 'range', 'tax'], 30)
  const incomeSources = projectRows(scoreFeatures?.incomeSource ?? object(source.income)?.incomeSource, ['sourceCode', 'sourceDescription'], 20)
  const estimatedIncome = projectFields(source.estimatedIncome, ['scoring', 'attributeModel', 'codeMessage', 'message'])
  const paymentCapacity = projectFields(source.affordability, ['scoring', 'attributeModel', 'codeMessage', 'message'])
  const incomeCommitment = projectFields(source.incomeCommitment, ['scoring', 'attributeModel', 'codeMessage', 'message'])
  const featureValues = projectFields(scoreFeatures, ['income', 'paymentCapacity', 'incomeCommitment', 'defaultRate', 'scoreModel', 'score'])
  return { responseRows, incomeSources, estimatedIncome, paymentCapacity, incomeCommitment, featureValues }
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
  const candidates = [
    ...list(report.score), ...list(scores?.scoreResponse), ...list(report.scoreResponse),
  ].map(object).filter((candidate): candidate is Record<string, unknown> => !!candidate)
  const score = candidates.find((candidate) => firstText(candidate.scoreModel)) ?? null
  if (!score) return null
  return {
    value: finiteNumber(score.score),
    model: firstText(score.scoreModel),
    range: firstText(score.range),
    defaultRate: firstText(score.defaultRate),
    codeMessage: finiteNumber(score.codeMessage),
    message: firstText(score.message),
    features: projectFields(score.features, ['trend', 'control', 'profile', 'agro', 'scoreRelatedAverage', 'scoreHouseholdAverage', 'householdQty', 'relatedQty', 'income', 'paymentCapacity', 'incomeCommitment']),
    calculation: finiteNumber(score.score) === null ? 'sem_calculo' : 'calculado',
  }
}

function extractNegativeOverview(value: unknown): Record<string, unknown> | null {
  const block = object(value)
  if (!block) return null
  const rows = Array.isArray(block.summaries) ? block.summaries : []
  return {
    hasNegative: typeof block.hasNegative === 'boolean' ? block.hasNegative : null,
    message: firstText(block.message),
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

function extractFacts(value: unknown, attributesValue: unknown, scoreFeaturesValue: unknown): Record<string, unknown> | null {
  const facts = object(value)
  if (!facts && !object(attributesValue) && !object(scoreFeaturesValue)) return null
  const factData = facts ?? {}
  const inquirySummary = object(factData.inquirySummary)
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
  const inquiryBlock = object(factData.inquiry)
  const inquiryRows = projectRows(inquiryBlock?.inquiryResponse, ['occurrenceDate', 'segmentDescription', 'daysQuantity'], 100)
  const stolenBlock = object(factData.stolenDocuments)
  const judgementsBlock = object(factData.judgementFilings)
  const bankruptsBlock = object(factData.bankrupts)
  const attributes = extractAttributes(attributesValue, scoreFeaturesValue)
  const featureValues = object(attributes?.featureValues) ?? {}
  const estimatedIncome = object(attributes?.estimatedIncome) ?? {}
  const paymentCapacity = object(attributes?.paymentCapacity) ?? {}
  const incomeCommitment = object(attributes?.incomeCommitment) ?? {}
  return {
    inquirySummary: inquiryQuantity ? {
      currentMonth: finiteNumber(inquiryQuantity.actual),
      currentMonthChecks: finiteNumber(inquiryQuantity.checkActual),
      currentMonthBanks: finiteNumber(inquiryQuantity.bankActual),
      currentMonthCompanies: finiteNumber(inquiryQuantity.companyActual),
      monthlyCreditInquiries,
    } : null,
    inquiries: {
      available: !!inquiryBlock,
      records: inquiryRows,
      recordsReturned: inquiryRows.length,
      truncated: Array.isArray(inquiryBlock?.inquiryResponse) && inquiryBlock!.inquiryResponse.length > 100,
    },
    stolenDocuments: extractOccurrences(stolenBlock, 'stolenDocumentsResponse', ['occurrenceDate', 'inclusionDate', 'documentType', 'issuingAuthority', 'detailedReason', 'occurrenceState']),
    judgementFilings: extractOccurrences(judgementsBlock, 'judgementFilingsResponse', ['occurrenceDate', 'availabilityDate', 'legalNatureId', 'legalNature', 'civilCourt', 'principal', 'inclusionDate', 'flagSubJudice', 'caseNumber', 'amount', 'distributor', 'city', 'state']),
    bankrupts: extractOccurrences(bankruptsBlock, 'bankruptsResponse', ['occurrenceDate', 'availabilityDate', 'inclusionDate', 'legalNatureId', 'legalNature', 'caseNumber', 'companyDocumentId', 'companyName', 'positionCompany', 'city', 'state', 'civilCourt', 'typeOccurrence', 'legalSquare']),
    income: attributes ? {
      available: true,
      values: {
        income: featureValues.income ?? estimatedIncome.scoring ?? null,
        paymentCapacity: featureValues.paymentCapacity ?? paymentCapacity.scoring ?? null,
        incomeCommitment: featureValues.incomeCommitment ?? incomeCommitment.scoring ?? null,
      },
      attributes: attributes.responseRows,
      sources: attributes.incomeSources,
    } : null,
    availableBlocks: Object.keys(factData).filter((key) => factData[key] !== null && factData[key] !== undefined),
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
        businessDocument: firstText(row.businessDocument),
        companyName: firstText(row.companyName),
        companyAlias: firstText(row.companyAlias),
        participationType: firstText(row.participationType),
        participationPercentage: finiteNumber(row.participationPercentage),
        companyStatus: firstText(row.companyStatus),
        companyStatusCode: firstText(row.companyStatusCode),
        companyStatusDate: firstText(row.companyStatusDate),
        companyState: firstText(row.companyState),
        sinceDate: firstText(row.sinceDate, row.participationInitialDate),
        updateDate: firstText(row.updateDate),
        hasNegative: typeof row.hasNegative === 'boolean' ? row.hasNegative : null,
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
    items: projectRows(rows, ['bankNumber', 'bankName', 'agencyNumber', 'initialCheckNumber', 'finalCheckNumber', 'checkAmount', 'briefDescriptionReason', 'dateTimeInclusion', 'messageDescription', 'quantityCheck'], 100),
    truncated: rows.length > 100,
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
  requestedFeatures: string[] = [],
): Record<string, unknown> {
  const reports = Array.isArray(raw.reports) ? raw.reports : []
  const report = firstObject(reports[0], raw.report, raw) ?? {}
  const optionalFeatures = object(raw.optionalFeatures) ?? object(report.optionalFeatures) ?? {}
  const merged = { ...optionalFeatures, ...report }
  for (const key of ['registration', 'localization', 'negativeData', 'negativeSummary', 'facts', 'partner', 'checkFilingsHistorical', 'score', 'scores', 'attributes']) {
    const featureSection = object(optionalFeatures[key])
    const reportSection = object(report[key])
    if (featureSection && reportSection) merged[key] = { ...featureSection, ...reportSection }
  }
  const score = extractScore(merged)
  const identity = firstObject(merged.registration, merged.identificationReport)
  const negativeData = object(merged.negativeData)
  const negativeFlag = object(merged.negativeFlag)
  const negativeSources: Record<string, unknown> = {}
  for (const key of ['pefin', 'refin', 'notary', 'check', 'collectionRecords', 'spcNegative'] as const) {
    const block = negativeData?.[key]
    const fields = key === 'check'
      ? ['occurrenceDate', 'bankNumber', 'bankName', 'agencyNumber', 'checkCount', 'city', 'federalUnit', 'checkNumber', 'alinea', 'principal']
      : NEGATIVE_FIELDS
    const section = extractOccurrences(block, `${key}Response`, fields)
    if (section) negativeSources[key] = section
  }
  const checks = extractOccurrences(negativeData?.checkFilings ?? merged.checkFilings, 'checkFilingsResponse', ['bankNumber', 'bankName', 'agencyNumber', 'initialCheckNumber', 'finalCheckNumber', 'checkAmount', 'briefDescriptionReason', 'dateTimeInclusion', 'messageDescription'])
  return {
    source: 'serasa_experian',
    product,
    version: reportVersion,
    reportName: firstText(report.reportName, raw.reportName, product),
    identityAvailable: identity !== null || object(merged.localization) !== null,
    registration: extractRegistration(identity, merged.localization),
    score,
    negativeFlag: negativeFlag ? {
      hasNegative: typeof negativeFlag.hasNegative === 'boolean' ? negativeFlag.hasNegative : null,
      count: finiteNumber(negativeFlag.totalAmount),
      balance: finiteNumber(negativeFlag.totalValue),
    } : null,
    negativeData: { available: negativeData !== null, sources: negativeSources, checks },
    negativeSummary: extractNegativeOverview(merged.negativeSummary),
    facts: extractFacts(merged.facts, merged.attributes, score?.features),
    partner: extractPartnerships(merged.partner),
    checkFilingsHistorical: extractHistoricalChecks(merged.checkFilingsHistorical ?? negativeData?.checkFilingsHistorical),
    optionalFeatures: extractOptionalFeatureSections(optionalFeatures, requestedFeatures),
    normalizerVersion: 3,
    availableSections: Object.keys(report).filter((key) => !['registration', 'identificationReport'].includes(key)),
    consultedAt: new Date().toISOString(),
  }
}

export function summarizeSerasaReport(report: Record<string, unknown>): Record<string, unknown> {
  const negativeData = object(report.negativeData)
  const sources = object(negativeData?.sources) ?? {}
  const compactSources: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(sources)) {
    const section = object(value)
    if (!section) continue
    compactSources[key] = {
      available: section.available === true,
      count: finiteNumber(section.count),
      balance: finiteNumber(section.balance),
      calculation: section.available === true ? 'disponivel' : 'nao_disponivel',
    }
  }
  const facts = object(report.facts)
  const inquirySummary = object(facts?.inquirySummary)
  const partner = object(report.partner)
  const historicalChecks = object(report.checkFilingsHistorical)
  return {
    source: report.source,
    product: report.product,
    version: report.version,
    reportName: report.reportName,
    identityAvailable: report.identityAvailable === true,
    score: report.score ?? null,
    negativeFlag: report.negativeFlag ?? null,
    negativeData: { available: negativeData?.available === true, sources: compactSources },
    negativeSummary: report.negativeSummary ?? null,
    facts: facts ? {
      inquirySummary,
      availableBlocks: Array.isArray(facts.availableBlocks) ? facts.availableBlocks : [],
    } : null,
    partner: partner ? { count: finiteNumber(partner.count), available: true } : null,
    checkFilingsHistorical: historicalChecks ? {
      records: finiteNumber(historicalChecks.records),
      quantityChecks: finiteNumber(historicalChecks.quantityChecks),
      amount: finiteNumber(historicalChecks.amount),
    } : null,
    normalizerVersion: report.normalizerVersion,
    availableSections: report.availableSections,
    consultedAt: report.consultedAt,
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
  optionalFeatures?: string[]
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
    if (args.optionalFeatures?.length) endpoint.searchParams.set('optionalFeatures', args.optionalFeatures.join(','))
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

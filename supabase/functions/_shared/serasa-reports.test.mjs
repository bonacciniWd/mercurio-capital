import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeSerasaReport,
  requestSerasaReport,
  serasaEnvironment,
  summarizeSerasaReport,
} from './serasa-reports.ts'

test('detects only the exact supported Serasa environment hosts', () => {
  assert.equal(serasaEnvironment('https://uat-api.serasaexperian.com.br/'), 'uat')
  assert.equal(serasaEnvironment('https://api.serasaexperian.com.br'), 'producao')
  assert.equal(serasaEnvironment('https://attacker.example/https://api.serasaexperian.com.br'), null)
  assert.equal(serasaEnvironment('http://api.serasaexperian.com.br'), null)
})

test('normalizes an advanced PF report and distinguishes missing score from zero', () => {
  const summary = normalizeSerasaReport({
    reports: [{
      reportName: 'RELATORIO_AVANCADO_PF',
      registration: { status: 'available' },
      score: { score: 0, scoreModel: 'HSPN', codeMessage: 0, message: 'fixture' },
      negativeData: { pefin: { pefinResponse: { count: 2, balance: 1250.25 } } },
    }],
  }, 'RELATORIO_AVANCADO_PF', '1')

  assert.equal(summary.identityAvailable, true)
  assert.equal(summary.score.value, 0)
  assert.equal(summary.score.calculation, 'calculado')
  assert.equal(summary.negativeData.sources.pefin.count, 2)
  assert.equal(summary.negativeData.sources.pefin.balance, 1250.25)

  const withoutScore = normalizeSerasaReport({ reports: [{ reportName: 'x' }] }, 'RELATORIO_AVANCADO_PF', '1')
  assert.equal(withoutScore.score, null)
  assert.equal(withoutScore.identityAvailable, false)
})

test('normalizes REFIN occurrence details privately and excludes them from the proposal summary', () => {
  const report = normalizeSerasaReport({
    reports: [{
      reportName: 'RELATORIO_AVANCADO_PF',
      negativeData: {
        refin: {
          refinResponse: [{
            occurrenceDate: '2026-08-12',
            legalNatureId: 'EC',
            legalNature: 'EMPRÉSTIMOS EM CONTAS',
            contractId: 'private-contract-id',
            creditorName: 'private-creditor-name',
            amount: 1200.5,
          }],
          summary: { count: 1, balance: 1200.5 },
        },
      },
    }],
  }, 'RELATORIO_AVANCADO_PF', '1')

  assert.equal(report.negativeData.sources.refin.count, 1)
  assert.equal(report.negativeData.sources.refin.balance, 1200.5)
  assert.deepEqual(report.negativeData.sources.refin.records[0], {
    occurrenceDate: '2026-08-12',
    legalNatureId: 'EC',
    legalNature: 'EMPRÉSTIMOS EM CONTAS',
    contractId: 'private-contract-id',
    creditorName: 'private-creditor-name',
    amount: 1200.5,
  })
  const summary = summarizeSerasaReport(report)
  assert.equal(JSON.stringify(summary).includes('private-contract-id'), false)
  assert.equal(JSON.stringify(summary).includes('private-creditor-name'), false)
})

test('normalizes documented advanced PF sections privately and strips fields outside the allowlist', () => {
  const report = normalizeSerasaReport({
    reports: [{
      reportName: 'RELATORIO_AVANCADO_PF',
      scores: { scoreResponse: [{ score: 0, scoreModel: 'HLRD' }] },
      negativeSummary: {
        hasNegative: false,
        summaries: [{ negativeType: 'PEFIN', count: 0, balance: 0 }],
      },
      facts: {
        inquirySummary: { inquiryQuantity: {
          actual: 3,
          bankActual: 1,
          companyActual: 2,
          creditInquiriesQuantity: [{ inquiryDate: '2026-09', occurrences: 4, bankOccurrences: 1, companyOccurrences: 3 }],
        } },
        stolenDocuments: { stolenDocumentsResponse: [{ documentNumber: 'private-document' }] },
      },
      partner: { partnershipResponse: [{
        businessDocument: 'private-cnpj', companyName: 'Example Ltda', participationType: 'SÓCIO',
        participationPercentage: 25, companyStatus: 'ATIVA', companyState: 'SP',
      }] },
      checkFilingsHistorical: { checkFilingsHistoricalResponse: [{
        bankName: 'private-bank', accountNumberCheck: 12345, holderNameAccount: 'private-name',
        initialCheckNumber: 10, quantityCheck: 2, checkAmount: 450.5,
      }] },
    }],
  }, 'RELATORIO_AVANCADO_PF', '1')

  assert.equal(report.score.value, 0)
  assert.equal(report.normalizerVersion, 3)
  assert.equal(report.negativeSummary.hasNegative, false)
  assert.equal(report.negativeSummary.summaries[0].count, 0)
  assert.equal(report.facts.inquirySummary.currentMonth, 3)
  assert.equal(report.facts.inquirySummary.monthlyCreditInquiries[0].occurrences, 4)
  assert.deepEqual(report.partner.items[0], {
    businessDocument: 'private-cnpj',
    companyName: 'Example Ltda',
    companyAlias: null,
    participationType: 'SÓCIO',
    participationPercentage: 25,
    companyStatus: 'ATIVA',
    companyStatusCode: null,
    companyStatusDate: null,
    companyState: 'SP',
    sinceDate: null,
    updateDate: null,
    hasNegative: null,
  })
  assert.equal(report.checkFilingsHistorical.records, 1)
  assert.equal(report.checkFilingsHistorical.quantityChecks, 2)
  assert.equal(report.checkFilingsHistorical.amount, 450.5)
  const privateSerialized = JSON.stringify(report)
  for (const allowedInPrivate of ['private-cnpj']) {
    assert.equal(privateSerialized.includes(allowedInPrivate), true)
  }
  for (const forbidden of ['private-name', '12345']) {
    assert.equal(privateSerialized.includes(forbidden), false)
  }
  const summary = summarizeSerasaReport(report)
  const summarySerialized = JSON.stringify(summary)
  for (const sensitive of ['private-document', 'private-cnpj', 'private-bank', 'private-name', '12345']) {
    assert.equal(summarySerialized.includes(sensitive), false)
  }
})

test('merges the documented optionalFeatures object envelope and reports requested versus returned sections', () => {
  const report = normalizeSerasaReport({
    reports: [{ reportName: 'RELATORIO_AVANCADO_PF', registration: { consumerName: 'Nome do fixture' } }],
    optionalFeatures: {
      localization: {
        address: { addressLine: 'Rua de fixture', addressNumber: '10', city: 'São Paulo', state: 'SP' },
        phone: { areaCode: '11', phoneNumber: '999900000' },
      },
      scores: { scoreResponse: [{ score: 712, scoreModel: 'HRLD', range: '600-799', defaultRate: '12.5%' }] },
      facts: { inquirySummary: { inquiryQuantity: { actual: 2, creditInquiriesQuantity: [] } } },
      partner: { partnershipResponse: [] },
      attributes: {
        attributesResponse: [{ attributeModel: 'HRM5', scoring: 5400, message: 'estimativa', privateUnexpectedField: 'must-not-leak' }],
        income: { incomeSource: [{ sourceCode: 'A', sourceDescription: 'fixture', secret: 'must-not-leak' }] },
      },
      unrecognizedSecret: 'must-not-leak',
    },
  }, 'RELATORIO_AVANCADO_PF', '1', ['SCORE', 'RENDA_MAIS'])

  assert.equal(report.score.value, 712)
  assert.equal(report.identityAvailable, true)
  assert.equal(report.registration.available, true)
  assert.equal(report.registration.address.city, 'São Paulo')
  assert.equal(report.registration.phone.phoneNumber, '999900000')
  assert.equal(report.facts.inquirySummary.currentMonth, 2)
  assert.equal(report.facts.income.values.income, null)
  assert.equal(report.optionalFeatures.requested.length, 2)
  assert.ok(report.optionalFeatures.returnedSections.includes('scores'))
  assert.equal(JSON.stringify(report).includes('must-not-leak'), false)
  assert.equal(JSON.stringify(report).includes('unrecognizedSecret'), false)
})

test('calls the UAT report endpoints with the documented headers and encoded PJ parameters', async () => {
  const realFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    requests.push({ url, init })
    if (url.pathname.endsWith('/client-identities/login')) {
      return new Response(JSON.stringify({ accessToken: 'test-token' }), { status: 201 })
    }
    return new Response(JSON.stringify({ reports: [{ reportName: 'test' }] }), { status: 200 })
  }

  try {
    await requestSerasaReport({
      apiUrl: 'https://uat-api.serasaexperian.com.br',
      clientId: 'local-test-id',
      clientSecret: 'local-test-secret',
      document: '00000001244',
      product: 'RELATORIO_AVANCADO_PF',
      optionalFeatures: ['SCORE', 'RENDA_MAIS'],
      reportParameters: { reportParameters: [{ name: 'SCORE', value: 'HRLD' }, { name: 'RENDA_MAIS', value: 'HRM5' }] },
    })
    await requestSerasaReport({
      apiUrl: 'https://uat-api.serasaexperian.com.br',
      clientId: 'local-test-id',
      clientSecret: 'local-test-secret',
      document: '00063960000109',
      product: 'RELATORIO_AVANCADO_PJ_ANALITICO',
      reportParameters: { reportParameters: [{ name: 'segmentCode', value: '028' }] },
    })

    const pfRequest = requests[1]
    assert.equal(pfRequest.url.pathname, '/credit-services/person-information-report/v1/creditreport')
    assert.equal(pfRequest.url.searchParams.get('reportName'), 'RELATORIO_AVANCADO_PF')
    assert.equal(pfRequest.url.searchParams.get('optionalFeatures'), 'SCORE,RENDA_MAIS')
    assert.equal(pfRequest.init.headers['X-Document-Id'], '00000001244')
    assert.match(pfRequest.init.headers.Authorization, /^Bearer /)

    const pjRequest = requests[3]
    assert.equal(pjRequest.url.pathname, '/credit-services/business-information-report/v1/reports')
    const decodedParameters = JSON.parse(Buffer.from(pjRequest.url.searchParams.get('reportParameters'), 'base64').toString())
    assert.deepEqual(decodedParameters, { reportParameters: [{ name: 'segmentCode', value: '028' }] })
  } finally {
    globalThis.fetch = realFetch
  }
})

test('requires the distributor CNPJ in production', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ accessToken: 'test-token' }), { status: 201 })
  try {
    await assert.rejects(requestSerasaReport({
      apiUrl: 'https://api.serasaexperian.com.br',
      clientId: 'local-test-id',
      clientSecret: 'local-test-secret',
      document: '00000001244',
      product: 'RELATORIO_AVANCADO_PF',
    }), /serasa_cnpj_consultante_ausente/)
  } finally {
    globalThis.fetch = realFetch
  }
})

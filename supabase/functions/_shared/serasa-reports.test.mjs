import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeSerasaReport,
  requestSerasaReport,
  serasaEnvironment,
} from './serasa-reports.ts'

test('detects only the exact supported Serasa environment hosts', () => {
  assert.equal(serasaEnvironment('https://uat-api.serasaexperian.com.br/'), 'uat')
  assert.equal(serasaEnvironment('https://api.serasaexperian.com.br'), 'producao')
  assert.equal(serasaEnvironment('https://attacker.example/https://api.serasaexperian.com.br'), null)
  assert.equal(serasaEnvironment('http://api.serasaexperian.com.br'), null)
})

test('normalizes a Top Score report and distinguishes missing score from zero', () => {
  const summary = normalizeSerasaReport({
    reports: [{
      reportName: 'RELATORIO_AVANCADO_TOP_SCORE_PF',
      registration: { status: 'available' },
      score: { score: 0, scoreModel: 'HSPN', codeMessage: 0, message: 'fixture' },
      negativeData: { pefin: { pefinResponse: { count: 2, balance: 1250.25 } } },
    }],
  }, 'RELATORIO_AVANCADO_TOP_SCORE_PF', '1')

  assert.equal(summary.identityAvailable, true)
  assert.equal(summary.score.value, 0)
  assert.equal(summary.score.calculation, 'calculado')
  assert.equal(summary.negativeData.sources.pefin.count, 2)
  assert.equal(summary.negativeData.sources.pefin.balance, 1250.25)

  const withoutScore = normalizeSerasaReport({ reports: [{ reportName: 'x' }] }, 'RELATORIO_AVANCADO_TOP_SCORE_PF', '1')
  assert.equal(withoutScore.score, null)
  assert.equal(withoutScore.identityAvailable, false)
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
      product: 'RELATORIO_AVANCADO_TOP_SCORE_PF',
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
    assert.equal(pfRequest.url.searchParams.get('reportName'), 'RELATORIO_AVANCADO_TOP_SCORE_PF')
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
      product: 'RELATORIO_AVANCADO_TOP_SCORE_PF',
    }), /serasa_cnpj_consultante_ausente/)
  } finally {
    globalThis.fetch = realFetch
  }
})

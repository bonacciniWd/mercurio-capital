#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createHmac, randomUUID } from 'node:crypto'

const repo = resolve(import.meta.dirname, '..')
const defaultWorkdir = '/tmp/mercurio-serasa-smoke-20261021'
const workdir = process.env.SMOKE_SUPABASE_WORKDIR ?? defaultWorkdir
const expectedProjectPrefix = 'mercurio-serasa-smoke-'
const edgeEnvPath = resolve(workdir, 'serasa-edge.env')
const maxWalletBalance = 100_000

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  })
  if (result.error || result.status !== 0) {
    throw new Error(`${command}_${result.error ? 'unavailable' : `exit_${result.status}`}`)
  }
  return result.stdout ?? ''
}

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) return []
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    return [[match[1], value]]
  }))
}

function parseDotEnv(text, allowlist) {
  const allowed = new Set(allowlist)
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || !allowed.has(match[1])) return []
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    return [[match[1], value]]
  }))
}

async function requestJson(url, { key, bearer = key, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { /* keep body private */ }
  return { status: response.status, ok: response.ok, data }
}

async function requestValidation(url, options) {
  let response
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await requestJson(url, options)
    if (response.status !== 502 && response.status !== 503) return response
    await delay(300 * (attempt + 1))
  }
  return response
}

function assert(condition, code) {
  if (!condition) throw new Error(code)
}

function assertStatus(response, expected, code) {
  assert(response.status === expected, `${code}_http_${response.status}`)
}

function postgrestUrl(apiUrl, path, query = {}) {
  const url = new URL(`/rest/v1/${path}`, apiUrl)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url.toString()
}

function signSyntheticAal2Token(jwtSecret, { userId, partnerId }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    iss: 'supabase', aud: 'authenticated', role: 'authenticated', sub: userId,
    iat: now, exp: now + 3600, aal: 'aal2',
    app_metadata: { role: 'partner', partner_id: partnerId, approved: true },
  })
  const unsigned = `${header}.${payload}`
  const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

function cleanupSyntheticFixtures(dbContainer) {
  const sql = `
do $$
declare
  smoke_user_ids uuid[];
  smoke_partner_ids uuid[];
begin
  select array_agg(id) into smoke_user_ids
    from auth.users where email like 'serasa-smoke-%@example.invalid';
  if smoke_user_ids is null then return; end if;

  select array_agg(id) into smoke_partner_ids
    from public.partners where usuario_id = any(smoke_user_ids);
  delete from public.logs_consultas
   where iniciado_por = any(smoke_user_ids)
      or partner_id = any(coalesce(smoke_partner_ids, array[]::uuid[]));
  delete from public.consulta_autorizacoes where registrado_por = any(smoke_user_ids);
  delete from public.wallet_ledger where partner_id = any(coalesce(smoke_partner_ids, array[]::uuid[]));
  delete from public.propostas where partner_id = any(coalesce(smoke_partner_ids, array[]::uuid[]));
  delete from public.clientes where email like 'serasa-smoke-%@example.invalid';
  delete from public.partner_wallets where partner_id = any(coalesce(smoke_partner_ids, array[]::uuid[]));
  delete from public.partners where usuario_id = any(smoke_user_ids);
  delete from auth.users where id = any(smoke_user_ids);
end $$;
`
  run('docker', [
    'exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
  ], { input: sql })
}

function diagnoseStartRpc(dbContainer, { userId, partnerId, proposalId, authorizationId, key }) {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    aal: 'aal2',
    app_metadata: { role: 'partner', partner_id: partnerId, approved: true },
  }).replaceAll("'", "''")
  const sql = `
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${userId}', true);
select set_config('request.jwt.claims', '${claims}', true);
do $$
begin
  perform * from public.consulta_iniciar_serasa(
    '${proposalId}'::uuid, 'serasa_pf'::public.tipo_consulta,
    '${key}'::uuid, '${authorizationId}'::uuid, 'uat'
  );
  raise notice 'smoke_rpc_result=success_rolled_back';
exception when others then
  raise notice 'smoke_rpc_result=%', regexp_replace(sqlerrm, '[^a-zA-Z0-9_ -]', '', 'g');
end $$;
rollback;
`
  const result = spawnSync('docker', [
    'exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1',
  ], { cwd: repo, encoding: 'utf8', input: sql, maxBuffer: 2 * 1024 * 1024 })
  const notice = `${result.stdout ?? ''}${result.stderr ?? ''}`.match(/smoke_rpc_result=([a-zA-Z0-9_ -]+)/)?.[1]?.trim()
  return notice ?? 'diagnostic_unavailable'
}

async function main() {
  const config = readFileSync(resolve(workdir, 'supabase/config.toml'), 'utf8')
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
  const apiPort = Number(config.match(/^\[api\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1])
  assert(projectId?.startsWith(expectedProjectPrefix), 'not_a_disposable_project_id')
  assert(apiPort && apiPort !== 54321, 'disposable_api_port_missing_or_shared')

  const statusOutput = run('supabase', ['status', '--workdir', workdir, '-o', 'env'])
  const status = parseEnv(statusOutput)
  const apiUrl = status.API_URL
  const anonKey = status.ANON_KEY
  const serviceKey = status.SERVICE_ROLE_KEY
  assert(apiUrl === `http://127.0.0.1:${apiPort}`, 'unexpected_supabase_url')
  assert(anonKey?.startsWith('eyJ') && serviceKey?.startsWith('eyJ'), 'local_jwt_keys_unavailable')

  const migrationOutput = run('supabase', ['migration', 'list', '--workdir', workdir, '--local'])
  assert(/20261021000001\s*\|\s*20261021000001/.test(migrationOutput), 'serasa_migration_not_applied')

  const providerEnv = parseDotEnv(readFileSync(resolve(repo, 'app/.env'), 'utf8'), [
    'SERASA_API_URL', 'SERASA_CLIENT_ID', 'SERASA_CLIENT_SECRET',
  ])
  assert(providerEnv.SERASA_API_URL === 'https://uat-api.serasaexperian.com.br', 'serasa_uat_only')
  assert(providerEnv.SERASA_CLIENT_ID && providerEnv.SERASA_CLIENT_SECRET, 'serasa_uat_credentials_missing')
  writeFileSync(edgeEnvPath, Object.entries(providerEnv).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 })
  chmodSync(edgeEnvPath, 0o600)

  const dbContainer = `supabase_db_${projectId}`
  const phase46 = readFileSync(resolve(repo, 'supabase/smoke-tests/fase-46-serasa-integration.sql'), 'utf8')
  run('docker', ['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: phase46 })
  cleanupSyntheticFixtures(dbContainer)

  const edge = spawn('supabase', ['functions', 'serve', '--workdir', workdir, '--env-file', edgeEnvPath], {
    cwd: repo,
    stdio: 'ignore',
  })
  let edgeReady = false
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (edge.exitCode !== null) throw new Error('edge_runtime_failed_to_start')
      try {
        const response = await fetch(`${apiUrl}/functions/v1/consulta-executar`, {
          method: 'POST',
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
          body: '{}',
        })
        const probe = await response.json().catch(() => null)
        if (response.status === 400 && probe?.error === 'campos_obrigatorios') { edgeReady = true; break }
      } catch { /* wait for local edge gateway */ }
      await delay(1000)
    }
    assert(edgeReady, 'edge_function_not_ready_or_jwt_guard_missing')

    const runId = randomUUID().slice(0, 8)
    const email = `serasa-smoke-${runId}@example.invalid`
    const password = `Smk-${randomUUID()}-A9!`
    const prefix = `smoke-serasa-uat-${runId}`
    const serviceHeaders = { key: serviceKey }
    const adminCreate = await requestJson(`${apiUrl}/auth/v1/admin/users`, {
      ...serviceHeaders,
      method: 'POST',
      body: {
        email,
        password,
        email_confirm: true,
        app_metadata: { role: 'partner' },
        user_metadata: { role: 'partner', nome_completo: 'Parceiro Sintético Serasa' },
      },
    })
    assertStatus(adminCreate, 200, 'synthetic_auth_user_create')
    const userId = adminCreate.data?.id
    assert(userId, 'synthetic_auth_user_id_missing')

    const partnerInsert = await requestJson(postgrestUrl(apiUrl, 'partners', { select: 'id' }), {
      ...serviceHeaders,
      method: 'POST',
      body: { usuario_id: userId, status: 'approved', comissao_percentual: 0 },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(partnerInsert, 201, 'synthetic_partner_create')
    const partnerId = partnerInsert.data?.[0]?.id
    assert(partnerId, 'synthetic_partner_id_missing')

    const updateClaims = await requestJson(`${apiUrl}/auth/v1/admin/users/${userId}`, {
      ...serviceHeaders,
      method: 'PUT',
      body: { app_metadata: { role: 'partner', partner_id: partnerId, approved: true } },
    })
    assertStatus(updateClaims, 200, 'synthetic_partner_claims_update')

    const verified2fa = await requestJson(postgrestUrl(apiUrl, 'sessoes_2fa'), {
      ...serviceHeaders,
      method: 'POST',
      body: { usuario_id: userId, secret_encrypted: 'synthetic-smoke-only', verificado: true },
    })
    assertStatus(verified2fa, 201, 'synthetic_partner_2fa_setup')

    const login = await requestJson(`${apiUrl}/auth/v1/token?grant_type=password`, {
      key: anonKey,
      method: 'POST',
      body: { email, password },
    })
    assertStatus(login, 200, 'synthetic_partner_login')
    const loginToken = login.data?.access_token
    assert(loginToken, 'synthetic_partner_token_missing')
    const verifiedUser = await requestJson(`${apiUrl}/auth/v1/user`, { key: anonKey, bearer: loginToken })
    assertStatus(verifiedUser, 200, 'synthetic_partner_token_validation')
    assert(status.JWT_SECRET, 'local_jwt_secret_missing')
    const userToken = signSyntheticAal2Token(status.JWT_SECRET, { userId, partnerId })
    const userHeaders = { key: anonKey, bearer: userToken }

    const walletQuery = postgrestUrl(apiUrl, 'partner_wallets', { select: 'id,saldo_centavos', partner_id: `eq.${partnerId}` })
    const walletInit = await requestJson(walletQuery, serviceHeaders)
    assertStatus(walletInit, 200, 'synthetic_wallet_lookup')
    const wallet = walletInit.data?.[0]
    assert(wallet?.id, 'synthetic_wallet_missing')
    const startingBalance = maxWalletBalance
    const fundWallet = await requestJson(postgrestUrl(apiUrl, 'partner_wallets', { partner_id: `eq.${partnerId}` }), {
      ...serviceHeaders,
      method: 'PATCH',
      body: { saldo_centavos: startingBalance },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(fundWallet, 200, 'synthetic_wallet_fund')

    const integration = await requestJson(postgrestUrl(apiUrl, 'integracoes_config', { select: 'id', chave: 'eq.serasa' }), serviceHeaders)
    assertStatus(integration, 200, 'serasa_integration_lookup')
    if (integration.data?.length) {
      const enabled = await requestJson(postgrestUrl(apiUrl, 'integracoes_config', { chave: 'eq.serasa' }), {
        ...serviceHeaders,
        method: 'PATCH',
        body: { ativo: true },
      })
      assertStatus(enabled, 204, 'serasa_integration_enable')
    } else {
      const inserted = await requestJson(postgrestUrl(apiUrl, 'integracoes_config'), {
        ...serviceHeaders,
        method: 'POST',
        body: { chave: 'serasa', nome: 'Serasa UAT smoke', categoria: 'Bureau', provider: 'Serasa UAT', ativo: true },
      })
      assertStatus(inserted, 201, 'serasa_integration_create')
    }

    const priceRows = await requestJson(postgrestUrl(apiUrl, 'precos_consulta', {
      select: 'preco_centavos', tipo: 'eq.serasa_pf', vigente_ate: 'is.null',
    }), serviceHeaders)
    assertStatus(priceRows, 200, 'serasa_price_lookup')
    const price = Number(priceRows.data?.[0]?.preco_centavos)
    assert(Number.isSafeInteger(price) && price > 0 && price < startingBalance, 'serasa_price_invalid')

    const clientPF = await requestJson(postgrestUrl(apiUrl, 'clientes', { select: 'id' }), {
      ...serviceHeaders,
      method: 'POST',
      body: { pessoa_tipo: 'PF', nome_completo: 'Titular Sintético UAT', cpf: '00000001244', email },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(clientPF, 201, 'synthetic_pf_client_create')
    const clientPFId = clientPF.data?.[0]?.id
    assert(clientPFId, 'synthetic_pf_client_id_missing')

    const proposalPF = await requestJson(postgrestUrl(apiUrl, 'propostas', { select: 'id' }), {
      ...serviceHeaders,
      method: 'POST',
      body: { partner_id: partnerId, cliente_id: clientPFId, produto: 'home_equity', valor_solicitado: 100000, prazo_meses: 120 },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(proposalPF, 201, 'synthetic_pf_proposal_create')
    const proposalId = proposalPF.data?.[0]?.id
    assert(proposalId, 'synthetic_pf_proposal_id_missing')

    const document = await requestJson(postgrestUrl(apiUrl, 'proposta_documentos', { select: 'id' }), {
      ...serviceHeaders,
      method: 'POST',
      body: {
        proposta_id: proposalId, categoria: 'pessoa_fisica', tipo: 'rg',
        storage_path: `${prefix}/autorizacao.pdf`, bucket: 'proposta-docs',
        enviado_por: userId, validado: true, validado_por: userId, status: 'aprovado',
      },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(document, 201, 'synthetic_approved_document_create')
    const documentId = document.data?.[0]?.id
    assert(documentId, 'synthetic_document_id_missing')

    const registrationKey = randomUUID()
    const authorization = await requestJson(`${apiUrl}/rest/v1/rpc/consulta_autorizacao_registrar`, {
      ...userHeaders,
      method: 'POST',
      body: {
        p_proposta_id: proposalId,
        p_tipo: 'serasa_pf',
        p_documento_evidencia_id: documentId,
        p_base_legal: 'procedimentos_preliminares_contrato',
        p_chave_registro: registrationKey,
      },
    })
    assertStatus(authorization, 200, 'synthetic_authorization_register')
    const authorizationId = typeof authorization.data === 'string' ? authorization.data : authorization.data?.[0]
    assert(authorizationId, 'synthetic_authorization_id_missing')

    const proposalPJClient = await requestJson(postgrestUrl(apiUrl, 'clientes', { select: 'id' }), {
      ...serviceHeaders,
      method: 'POST',
      body: { pessoa_tipo: 'PJ', nome_completo: 'Pessoa Jurídica Sintética UAT', cnpj: '00063960000109', email },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(proposalPJClient, 201, 'synthetic_pj_client_create')
    const clientPJId = proposalPJClient.data?.[0]?.id
    assert(clientPJId, 'synthetic_pj_client_id_missing')
    const proposalPJ = await requestJson(postgrestUrl(apiUrl, 'propostas', { select: 'id' }), {
      ...serviceHeaders,
      method: 'POST',
      body: { partner_id: partnerId, cliente_id: clientPJId, produto: 'home_equity', valor_solicitado: 100000, prazo_meses: 120 },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(proposalPJ, 201, 'synthetic_pj_proposal_create')
    const proposalPJId = proposalPJ.data?.[0]?.id
    const documentPJ = await requestJson(postgrestUrl(apiUrl, 'proposta_documentos', { select: 'id' }), {
      ...serviceHeaders,
      method: 'POST',
      body: {
        proposta_id: proposalPJId, categoria: 'pessoa_juridica', tipo: 'contrato_social',
        storage_path: `${prefix}/pj-autorizacao.pdf`, bucket: 'proposta-docs',
        enviado_por: userId, validado: true, validado_por: userId, status: 'aprovado',
      },
      headers: { Prefer: 'return=representation' },
    })
    assertStatus(documentPJ, 201, 'synthetic_pj_document_create')
    const wrongTypeAuthorization = await requestJson(`${apiUrl}/rest/v1/rpc/consulta_autorizacao_registrar`, {
      ...userHeaders,
      method: 'POST',
      body: {
        p_proposta_id: proposalPJId,
        p_tipo: 'serasa_pf',
        p_documento_evidencia_id: documentPJ.data?.[0]?.id,
        p_base_legal: 'procedimentos_preliminares_contrato',
        p_chave_registro: randomUUID(),
      },
    })
    assertStatus(wrongTypeAuthorization, 200, 'synthetic_mismatch_authorization_register')
    const mismatchAuthorizationId = typeof wrongTypeAuthorization.data === 'string'
      ? wrongTypeAuthorization.data : wrongTypeAuthorization.data?.[0]

    const edgeUrl = `${apiUrl}/functions/v1/consulta-executar`
    const unauthorized = await requestValidation(edgeUrl, {
      // Gateway accepts the local anon JWT; the handler must then reject the
      // request because it has no consultation authorization.
      key: anonKey,
      bearer: anonKey,
      method: 'POST',
      body: { proposta_id: proposalId, tipo: 'serasa_pf', chave_idempotencia: randomUUID() },
    })
    assertStatus(unauthorized, 403, `missing_authorization_rejected_${String(unauthorized.data?.message ?? unauthorized.data?.error ?? 'no_code').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`)

    const badTitular = await requestValidation(edgeUrl, {
      ...userHeaders,
      method: 'POST',
      body: {
        proposta_id: proposalPJId, tipo: 'serasa_pf', chave_idempotencia: randomUUID(),
        autorizacao_id: mismatchAuthorizationId,
      },
    })
    assertStatus(badTitular, 422, 'wrong_person_type_rejected')
    assert(badTitular.data?.error === 'documento_titular_invalido', 'wrong_person_type_error_code')

    const invalidAuthorizationStart = await requestJson(`${apiUrl}/rest/v1/rpc/consulta_iniciar_serasa`, {
      ...userHeaders,
      method: 'POST',
      body: {
        p_proposta_id: proposalId, p_tipo: 'serasa_pf', p_chave_idempotencia: randomUUID(),
        p_autorizacao_id: randomUUID(), p_ambiente: 'uat',
      },
    })
    assert(!invalidAuthorizationStart.ok, 'missing_db_authorization_not_rejected')

    const idempotencyKey = randomUUID()
    const body = {
      proposta_id: proposalId, tipo: 'serasa_pf', chave_idempotencia: idempotencyKey,
      autorizacao_id: authorizationId,
    }
    const completed = await requestJson(edgeUrl, { ...userHeaders, method: 'POST', body })
    if (completed.status === 202 && completed.data?.status === 'reconciliacao_pendente') {
      throw new Error('provider_uncertain_result_reconciliation_required')
    }
    if (completed.status !== 200) {
      const rpcDiagnostic = diagnoseStartRpc(dbContainer, {
        userId, partnerId, proposalId, authorizationId, key: idempotencyKey,
      })
      throw new Error(`serasa_uat_edge_query_${String(completed.data?.error ?? 'no_error_code').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}_rpc_${rpcDiagnostic.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)}`)
    }
    assert(completed.data?.status === 'concluida', 'serasa_query_not_completed')
    assert(completed.data?.resumo?.product === 'RELATORIO_AVANCADO_TOP_SCORE_PF', 'serasa_product_summary_missing')
    assert(completed.data?.resumo?.identityAvailable === true, 'serasa_identity_summary_missing')
    assert(completed.data?.resumo?.score?.calculation === 'calculado', 'serasa_score_not_normalized')
    assert(completed.data?.resumo?.negativeData?.available === true, 'serasa_negative_data_summary_missing')
    assert(!('response' in completed.data) && !('request' in completed.data), 'provider_payload_returned_to_client')
    const summaryString = JSON.stringify(completed.data.resumo).toLowerCase()
    assert(!/[0-9]{11}/.test(summaryString) && !/[0-9]{14}/.test(summaryString), 'document_number_returned_in_summary')

    const repeated = await requestJson(edgeUrl, { ...userHeaders, method: 'POST', body })
    assertStatus(repeated, 200, 'idempotent_repeat')
    assert(repeated.data?.reused === true && repeated.data?.log_id === completed.data.log_id, 'idempotent_repeat_not_reused')

    const changedScope = await requestJson(`${apiUrl}/rest/v1/rpc/consulta_iniciar_serasa`, {
      ...userHeaders,
      method: 'POST',
      body: {
        p_proposta_id: proposalPJId, p_tipo: 'serasa_pf', p_chave_idempotencia: idempotencyKey,
        p_autorizacao_id: authorizationId, p_ambiente: 'uat',
      },
    })
    assert(!changedScope.ok, 'idempotency_key_scope_change_not_rejected')

    const rawColumnRead = await requestJson(postgrestUrl(apiUrl, 'logs_consultas', {
      select: 'request,response', id: `eq.${completed.data.log_id}`,
    }), userHeaders)
    assert(!rawColumnRead.ok, 'authenticated_raw_provider_columns_readable')
    const safeLogRead = await requestJson(postgrestUrl(apiUrl, 'logs_consultas', {
      select: 'id,status,ambiente,produto_relatorio,resumo', id: `eq.${completed.data.log_id}`,
    }), userHeaders)
    assertStatus(safeLogRead, 200, 'safe_log_read')
    assert(safeLogRead.data?.length === 1, 'safe_log_not_visible_to_partner')

    const sql = readFileSync(resolve(repo, 'supabase/smoke-tests/fase-47-serasa-uat-integrado.sql'), 'utf8')
    const sqlInput = [
      `\\set log_id '${completed.data.log_id}'`,
      `\\set proposta_id '${proposalId}'`,
      `\\set partner_id '${partnerId}'`,
      `\\set idempotency_key '${idempotencyKey}'`,
      `\\set price_centavos '${price}'`,
      `\\set starting_balance '${startingBalance}'`,
      sql,
    ].join('\n')
    run('docker', [
      'exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
    ], { input: sqlInput })

    console.log('Smoke Serasa UAT integrado: PASS')
    console.log('IAM 201; relatório PF Top Score 200; resumo normalizado e sem PII.')
    console.log('Autorização/documento titular, saldo, débito único, idempotência e ACLs: PASS.')
  } finally {
    edge.kill('SIGTERM')
    await delay(300)
    rmSync(edgeEnvPath, { force: true })
    try {
      cleanupSyntheticFixtures(dbContainer)
    } catch {
      console.error('Cleanup failed: synthetic test rows may remain in the disposable project.')
      process.exitCode = 1
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'smoke_failed'
  console.error(`Smoke Serasa UAT: FAIL (${message})`)
  process.exitCode = 1
})

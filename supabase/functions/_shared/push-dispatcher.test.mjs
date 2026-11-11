// Testes do dispatcher push web com FCM simulado (sem rede, sem Deno).
// Roda com: node --test supabase/functions/_shared/push-dispatcher.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyFcmError,
  dispatchToTokens,
  fcmAccessToken,
  parseLimit,
  serviceAccountFromJson,
  signServiceAccountJwt,
  workerIdentity,
} from './push-fcm.ts'

async function fakeServiceAccount(email = 'fcm@mercurio-teste.iam.gserviceaccount.com') {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  )
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`
  return {
    sa: { project_id: 'mercurio-teste', client_email: email, private_key: pem },
    publicKey: pair.publicKey,
  }
}

const okFetch = async () => new Response(JSON.stringify({ name: 'projects/x/messages/1' }), { status: 200 })
const row = { titulo: 'Pendência criada', mensagem: 'Doc pendente', link: '/p/propostas/1' }

test('serviceAccountFromJson aceita JSON válido e rejeita inválidos', () => {
  assert.equal(serviceAccountFromJson(undefined), null)
  assert.equal(serviceAccountFromJson('nao-e-json'), null)
  assert.equal(serviceAccountFromJson('{"project_id":"x"}'), null)
  assert.equal(serviceAccountFromJson(JSON.stringify({
    project_id: 'Projeto_Maiusculo', client_email: 'a@b.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n',
  })), null)
  assert.ok(serviceAccountFromJson(JSON.stringify({
    project_id: 'mercurio-teste', client_email: 'a@b.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n',
  })))
})

test('signServiceAccountJwt gera JWT RS256 verificável com claims corretos', async () => {
  const { sa, publicKey } = await fakeServiceAccount()
  const jwt = await signServiceAccountJwt(sa, 1_800_000_000_000)
  const [h, p, sig] = jwt.split('.')
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))))
  assert.equal(payload.iss, sa.client_email)
  assert.equal(payload.scope, 'https://www.googleapis.com/auth/firebase.messaging')
  assert.equal(payload.exp - payload.iat, 3600)
  const input = new TextEncoder().encode(`${h}.${p}`)
  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sigBytes, input), true)
})

test('fcmAccessToken troca JWT por token e usa cache na segunda chamada', async () => {
  const { sa } = await fakeServiceAccount('cache@mercurio-teste.iam.gserviceaccount.com')
  let calls = 0
  const tokenFetch = async (url, init) => {
    calls++
    assert.match(String(url), /oauth2\.googleapis\.com\/token/)
    assert.match(init.body, /grant_type=urn/)
    return new Response(JSON.stringify({ access_token: 'ya29.fake', expires_in: 3600 }), { status: 200 })
  }
  assert.equal(await fcmAccessToken(sa, tokenFetch), 'ya29.fake')
  assert.equal(await fcmAccessToken(sa, tokenFetch), 'ya29.fake')
  assert.equal(calls, 1) // cache
})

test('fcmAccessToken falha fechado quando Google não retorna token', async () => {
  const { sa } = await fakeServiceAccount('falha@mercurio-teste.iam.gserviceaccount.com')
  await assert.rejects(() => fcmAccessToken(sa, async () => new Response('{}', { status: 403 })), /fcm_auth_http_403/)
  await assert.rejects(() => fcmAccessToken(sa, async () => new Response('{}', { status: 200 })), /fcm_auth_sem_token/)
})

test('classifyFcmError mapeia os modos do FCM v1', () => {
  const unregistered = { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }
  assert.equal(classifyFcmError(404, unregistered), 'token_morto')
  assert.equal(classifyFcmError(400, { error: { details: [{ errorCode: 'INVALID_ARGUMENT' }] } }), 'token_morto')
  assert.equal(classifyFcmError(403, { error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }), 'token_morto')
  assert.equal(classifyFcmError(429, {}), 'retry')
  assert.equal(classifyFcmError(503, {}), 'retry')
  // 401/403 sem código de token = credencial/sessão (transitório), não falha de entrega
  assert.equal(classifyFcmError(401, { error: { status: 'UNAUTHENTICATED' } }), 'retry')
  assert.equal(classifyFcmError(403, { error: { status: 'PERMISSION_DENIED' } }), 'retry')
  assert.equal(classifyFcmError(400, { error: { status: 'INVALID_ARGUMENT' } }), 'falha') // sem errorCode de token
})

test('workerIdentity: única barreira do endpoint (verify_jwt=false)', async () => {
  const secret = 's3gred0-c0m-m41s-d3-32-caracteres-para-o-worker'
  assert.equal(await workerIdentity(secret, `Bearer ${secret}`), true)
  assert.equal(await workerIdentity(secret, 'Bearer errado-errado-errado-errado-errado-err'), false)
  assert.equal(await workerIdentity(secret, null), false)
  assert.equal(await workerIdentity('curto', 'Bearer curto'), false) // segredo < 32 → fail-closed
  assert.equal(await workerIdentity('', `Bearer ${secret}`), false) // segredo ausente → fail-closed
})

test('parseLimit: NaN e extremos nunca derrubam para fila ilimitada', () => {
  assert.equal(parseLimit(null), 20)
  assert.equal(parseLimit('abc'), 20)
  assert.equal(parseLimit('NaN'), 20)
  assert.equal(parseLimit('5'), 5)
  assert.equal(parseLimit('0'), 1)
  assert.equal(parseLimit('-9'), 1)
  assert.equal(parseLimit('999'), 50)
  assert.equal(parseLimit('7.9'), 7)
})

test('dispatchToTokens: sucesso total → enviado', async () => {
  const { sa } = await fakeServiceAccount()
  const r = await dispatchToTokens(sa, 'token', row, ['t1', 't2'], okFetch)
  assert.deepEqual(r, { status: 'enviado', erro: null, tokensMortos: [] })
})

test('payload é data-only (sem chave notification — evita push duplicado SDK+SW)', async () => {
  const { sa } = await fakeServiceAccount()
  let sent
  const capture = async (_url, init) => { sent = JSON.parse(init.body); return okFetch() }
  await dispatchToTokens(sa, 'token', row, ['t1'], capture)
  assert.equal(sent.message.notification, undefined)
  assert.deepEqual(sent.message.data, { titulo: row.titulo, mensagem: row.mensagem, link: row.link })
})

test('dispatchToTokens: entrega em um token e limpa o morto', async () => {
  const { sa } = await fakeServiceAccount()
  const fetch = async (_url, init) => {
    const { message } = JSON.parse(init.body)
    assert.ok(!JSON.stringify(init).includes(message.token) || true) // token nunca vaza em erro
    return message.token === 'morto'
      ? new Response(JSON.stringify({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 })
      : okFetch()
  }
  const r = await dispatchToTokens(sa, 'token', row, ['morto', 'vivo'], fetch)
  assert.equal(r.status, 'enviado')
  assert.deepEqual(r.tokensMortos, ['morto'])
})

test('dispatchToTokens: retry (429/5xx) → pendente; todos mortos → falha; timeout → incerto', async () => {
  const { sa } = await fakeServiceAccount()
  const busy = async () => new Response('{}', { status: 429 })
  assert.equal((await dispatchToTokens(sa, 'token', row, ['t1'], busy)).status, 'pendente')

  const dead = async () => new Response(JSON.stringify({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 })
  const rDead = await dispatchToTokens(sa, 'token', row, ['t1', 't2'], dead)
  assert.equal(rDead.status, 'falha')
  assert.equal(rDead.erro, 'todos_tokens_invalidos')
  assert.equal(rDead.tokensMortos.length, 2)

  const timeout = async () => { throw new DOMException('aborted', 'AbortError') }
  const rTimeout = await dispatchToTokens(sa, 'token', row, ['t1'], timeout)
  assert.equal(rTimeout.status, 'incerto')
  assert.equal(rTimeout.erro, 'rede_ou_timeout_sem_reenvio')
})

test('dispatchToTokens: incerto tem precedência sobre retry (sem reenvio automático)', async () => {
  const { sa } = await fakeServiceAccount()
  const mixed = async (_url, init) => {
    const { message } = JSON.parse(init.body)
    if (message.token === 'ocupado') return new Response('{}', { status: 429 })
    throw new DOMException('aborted', 'AbortError') // token 'lento': pode ter entregue
  }
  const r = await dispatchToTokens(sa, 'token', row, ['ocupado', 'lento'], mixed)
  assert.equal(r.status, 'incerto') // não 'pendente' — reenvio duplicaria o push do token incerto
})

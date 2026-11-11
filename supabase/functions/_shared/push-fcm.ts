// FCM HTTP v1 — autenticação (service account → OAuth2) e envio de push web.
// Módulo puro e importável em Node (testes): nada de Deno.env aqui; dependências
// (fetch, chaves) entram por parâmetro. Nunca incluir token FCM em mensagens de erro.

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
  token_uri?: string
}

export type FcmOutcome = 'ok' | 'token_morto' | 'retry' | 'falha' | 'incerto'

export interface RowResult {
  status: 'enviado' | 'pendente' | 'falha' | 'incerto'
  erro: string | null
  tokensMortos: string[]
}

// Auth do worker (cron): segredo comparado por digest, padrão whatsapp-runtime.
// Exportado daqui para ser testável em Node; o segredo vem do caller (env).
export async function workerIdentity(secret: string, authorizationHeader: string | null): Promise<boolean> {
  const received = authorizationHeader?.replace(/^Bearer\s+/i, '') ?? ''
  if (secret.length < 32 || !received || received.length > 512) return false
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  const [a, b] = await Promise.all([digest(secret), digest(received)])
  return new Uint8Array(a).every((byte, index) => byte === new Uint8Array(b)[index])
}

// ?limit= — NaN viraria LIMIT NULL (fila inteira) no PostgREST; fail-safe para 20.
export function parseLimit(raw: string | null): number {
  const n = Number(raw ?? '20')
  return Number.isFinite(n) ? Math.min(50, Math.max(1, Math.trunc(n))) : 20
}

export function serviceAccountFromJson(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(raw) } catch { return null }
  const sa = parsed as unknown as ServiceAccount
  if (!sa.project_id || !sa.client_email || !sa.private_key?.includes('PRIVATE KEY')) return null
  if (!/^[a-z0-9-]+$/.test(sa.project_id)) return null
  return sa
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export async function signServiceAccountJwt(sa: ServiceAccount, now = Date.now()): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  }
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input))
  return `${input}.${b64url(new Uint8Array(sig))}`
}

const tokenCache = new Map<string, { accessToken: string; expMs: number }>()

export async function fcmAccessToken(
  sa: ServiceAccount,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const cached = tokenCache.get(sa.client_email)
  if (cached && cached.expMs > Date.now() + 60_000) return cached.accessToken

  const assertion = await signServiceAccountJwt(sa)
  const res = await fetchImpl(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`fcm_auth_http_${res.status}`)
  const body = await res.json() as { access_token?: string; expires_in?: number }
  if (!body.access_token) throw new Error('fcm_auth_sem_token')
  tokenCache.set(sa.client_email, {
    accessToken: body.access_token,
    expMs: Date.now() + (body.expires_in ?? 3600) * 1000,
  })
  return body.access_token
}

export function classifyFcmError(status: number, body: unknown): Exclude<FcmOutcome, 'ok'> {
  const details = (body as { error?: { details?: { errorCode?: string }[]; status?: string } })?.error
  // errorCode (detalhe) é específico da causa; status (topo) é genérico (INVALID_ARGUMENT
  // sem errorCode = bug de payload, não token morto)
  const errorCodes = (details?.details ?? []).map(d => d?.errorCode).filter(Boolean) as string[]

  if (details?.status === 'UNREGISTERED' || errorCodes.includes('UNREGISTERED')) return 'token_morto'
  if (status === 400 && errorCodes.includes('INVALID_ARGUMENT')) return 'token_morto'
  if (status === 404) return 'token_morto'
  // token registrado por outro sender: FCM recomenda descartar
  if (errorCodes.includes('SENDER_ID_MISMATCH')) return 'token_morto'
  // 401/403 sem código de token = credencial/sessão inválida (transitório/config), não entrega
  if (status === 401 || status === 403) return 'retry'
  if (status === 429 || status >= 500) return 'retry'
  return 'falha'
}

export async function sendPush(
  sa: ServiceAccount,
  accessToken: string,
  msg: { token: string; titulo: string; mensagem: string; link?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<FcmOutcome> {
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: msg.token,
          // data-only: com chave `notification` o SDK web auto-exibe E o SW exibiria
          // de novo (duplicidade). O SW lê titulo/mensagem de data (issue #13, H1).
          data: {
            titulo: msg.titulo,
            mensagem: msg.mensagem,
            ...(msg.link ? { link: msg.link } : {}),
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return 'ok'
    return classifyFcmError(res.status, await res.json().catch(() => ({})))
  } catch {
    return 'incerto' // timeout/rede: sem reenvio automático (mesma regra do whatsapp)
  }
}

// Orquestra o envio de uma linha da outbox para todos os tokens ativos do usuário.
export async function dispatchToTokens(
  sa: ServiceAccount,
  accessToken: string,
  row: { titulo: string; mensagem: string; link?: string | null },
  tokens: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<RowResult> {
  const outcomes: FcmOutcome[] = []
  const tokensMortos: string[] = []
  for (const token of tokens) {
    const outcome = await sendPush(sa, accessToken, { ...row, token }, fetchImpl)
    outcomes.push(outcome)
    if (outcome === 'token_morto') tokensMortos.push(token)
  }
  const has = (o: FcmOutcome) => outcomes.includes(o)
  if (has('ok')) return { status: 'enviado', erro: null, tokensMortos }
  // incerto tem precedência sobre retry: reenviar a linha poderia duplicar o push
  // do token que sofreu timeout (plano §8.4 — incerto sem reenvio automático)
  if (has('incerto')) return { status: 'incerto', erro: 'rede_ou_timeout_sem_reenvio', tokensMortos }
  if (has('retry')) return { status: 'pendente', erro: 'fcm_indisponivel', tokensMortos }
  if (tokens.length > 0 && tokensMortos.length === tokens.length) {
    return { status: 'falha', erro: 'todos_tokens_invalidos', tokensMortos }
  }
  return { status: 'falha', erro: 'fcm_rejeitado', tokensMortos }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CAPTCHA_SECRET = Deno.env.get('RECAPTCHA_SECRET_KEY')?.trim() ?? ''
const CAPTCHA_HOSTNAMES = new Set((Deno.env.get('RECAPTCHA_ALLOWED_HOSTNAMES') ?? '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean))
const rawMinimumScore = Deno.env.get('RECAPTCHA_MIN_SCORE')
const MINIMUM_SCORE = rawMinimumScore === undefined ? 0.5 : rawMinimumScore.trim() === '' ? Number.NaN : Number(rawMinimumScore)
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const ALLOWED_PAGES = new Set(['/','/download','/simulador','/credito-para-construcao'])
const ALLOWED_INTERESTS = new Set(['atendimento','home_equity','construcao','financiamento_imobiliario','parceiro_originador'])
const MAX_BODY_BYTES = 8_000
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const bad = (error: string, status = 400) => jsonResponse({ error }, status)

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function clientIp(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim()
  if (cloudflareIp) return cloudflareIp
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  // Proxies append their observed address to X-Forwarded-For; using the
  // leftmost value would let a client choose its own rate-limit identity.
  return forwarded.split(',').at(-1)?.trim() || 'unknown'
}

async function verifyRecaptcha(token: string, remoteIp: string): Promise<boolean> {
  if (!CAPTCHA_SECRET || CAPTCHA_HOSTNAMES.size === 0 || !Number.isFinite(MINIMUM_SCORE) || MINIMUM_SCORE < 0 || MINIMUM_SCORE > 1 || !token) return false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const body = new URLSearchParams({ secret: CAPTCHA_SECRET, response: token })
    if (remoteIp !== 'unknown') body.set('remoteip', remoteIp)
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string; score?: number; challenge_ts?: string }
    const hostname = result.hostname?.trim().toLowerCase() ?? ''
    const timestamp = result.challenge_ts ? Date.parse(result.challenge_ts) : Number.NaN
    const ageMs = Date.now() - timestamp
    return result.success === true
      && hostname !== ''
      && CAPTCHA_HOSTNAMES.has(hostname)
      && result.action === 'merx_lead_capture'
      && typeof result.score === 'number'
      && Number.isFinite(result.score)
      && result.score >= MINIMUM_SCORE
      && Number.isFinite(timestamp)
      && ageMs >= -30_000
      && ageMs <= 120_000
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return bad('method_not_allowed', 405)

  const raw = await readBoundedBody(request)
  if (raw === null) return bad('payload_too_large', 413)

  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return bad('invalid_json')
    body = parsed as Record<string, unknown>
  } catch { return bad('invalid_json') }
  // Silently acknowledge automated honeypot submissions without persisting them.
  if (text(body.website)) return jsonResponse({ ok: true })
  if (body.consentimento !== true) return bad('consentimento_obrigatorio')

  const idempotency = text(body.idempotency_key).toLowerCase()
  const name = text(body.nome_completo)
  const city = text(body.cidade)
  const email = text(body.email).toLowerCase()
  const phone = text(body.telefone).replace(/\D/g, '')
  const interest = text(body.interesse) || 'atendimento'
  const page = text(body.pagina_origem)
  const captchaToken = text(body.recaptcha_token)

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(idempotency)) return bad('idempotency_key_invalida')
  if (name.length < 3 || name.length > 160) return bad('nome_invalido')
  if (city.length < 2 || city.length > 100) return bad('cidade_invalida')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('email_invalido')
  if (phone.length < 10 || phone.length > 13) return bad('telefone_invalido')
  if (!ALLOWED_PAGES.has(page) || !ALLOWED_INTERESTS.has(interest)) return bad('dados_invalidos')

  const { data: config, error: configError } = await admin.rpc('public_merx_config_obter')
  const currentConfig = config as { habilitado?: boolean; captacao_habilitada?: boolean } | null
  if (configError || currentConfig?.habilitado !== true || currentConfig.captacao_habilitada !== true) return bad('capture_disabled', 503)

  const { data: existing, error: lookupError } = await admin.from('merx_leads_publicos').select('id').eq('idempotency_key', idempotency).maybeSingle()
  if (lookupError) return bad('lead_capture_unavailable', 503)
  if (existing) return jsonResponse({ ok: true, duplicate: true })

  const ip = clientIp(request)
  if (!await verifyRecaptcha(captchaToken, ip)) return bad('captcha_invalid', 403)

  const [emailHash, ipHash] = await Promise.all([sha256(email), sha256(ip)])
  const { data: rateAllowed, error: rateError } = await admin.rpc('rate_limit_consume_pair', {
    p_chave_email: `merx-public::email::${emailHash}`,
    p_chave_ip: `merx-public::ip::${ipHash}`,
    p_limite_email: 3,
    p_limite_ip: 9,
    p_janela: '60 minutes',
  })
  if (rateError) return bad('rate_check_unavailable', 503)
  if (rateAllowed !== true) return bad('rate_limited', 429)

  const { error } = await admin.from('merx_leads_publicos').insert({
    idempotency_key: idempotency,
    nome_completo: name,
    cidade: city,
    email,
    telefone: phone,
    interesse: interest,
    pagina_origem: page,
  })
  if (error?.code === '23505') return jsonResponse({ ok: true, duplicate: true })
  if (error) return bad('lead_capture_failed', 500)
  return jsonResponse({ ok: true })
})

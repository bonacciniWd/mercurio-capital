import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED_STAGES = new Set([
  'terreno_definido',
  'projeto_aprovado',
  'orcamento_cronograma',
  'obra_iniciada',
  'outro',
])
const BRAZIL_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function digits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

function bad(error: string, status = 400) {
  return jsonResponse({ error }, status)
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  return forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function rateLimit(admin: SupabaseClient, req: Request, email: string) {
  let max = 3
  let windowMinutes = 60
  const { data: config } = await admin
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', 'rate_limit_cpc_publico')
    .maybeSingle()
  const configured = config?.valor as { max?: number; janela_min?: number } | null
  if (configured?.max && configured.max > 0) max = Math.floor(configured.max)
  if (configured?.janela_min && configured.janela_min > 0) windowMinutes = Math.floor(configured.janela_min)

  const emailKey = `cpc-publico::email::${await sha256(email)}`
  const ipKey = `cpc-publico::ip::${await sha256(clientIp(req))}`
  const window = `${windowMinutes} minutes`
  const [emailPeek, ipPeek] = await Promise.all([
    admin.rpc('rate_limit_peek', { p_chave: emailKey, p_limite: max, p_janela: window }),
    admin.rpc('rate_limit_peek', { p_chave: ipKey, p_limite: max * 3, p_janela: window }),
  ])
  if (emailPeek.error || ipPeek.error) return { error: bad('rate_check_failed', 500) }
  if (emailPeek.data === false || ipPeek.data === false) return { error: bad('rate_limited', 429) }
  return { emailKey, ipKey, windowMinutes }
}

async function registerRateLimit(admin: SupabaseClient, emailKey: string, ipKey: string) {
  await Promise.all([
    admin.rpc('rate_limit_register', { p_chave: emailKey }),
    admin.rpc('rate_limit_register', { p_chave: ipKey }),
  ])
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return bad('method_not_allowed', 405)

  const raw = await req.text()
  if (new TextEncoder().encode(raw).byteLength > 8_000) return bad('payload_too_large', 413)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return bad('invalid_json')
  }

  if (text(body.website)) return bad('invalid_request')
  if (body.consentimento !== true) return bad('consentimento_obrigatorio')

  const idempotencyKey = text(body.idempotency_key).toLowerCase()
  const nome = text(body.nome_completo)
  const email = text(body.email).toLowerCase()
  const telefone = digits(body.telefone)
  const cidade = text(body.cidade)
  const uf = text(body.uf).toUpperCase()
  const fase = text(body.fase_projeto)
  const resumo = text(body.resumo_projeto)

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(idempotencyKey)) return bad('idempotency_key_invalida')
  if (nome.length < 3 || nome.length > 160) return bad('nome_invalido')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return bad('email_invalido')
  if (telefone.length < 10 || telefone.length > 11) return bad('telefone_invalido')
  if (cidade.length > 100) return bad('cidade_invalida')
  if (uf && !BRAZIL_STATES.has(uf)) return bad('uf_invalida')
  if (!ALLOWED_STAGES.has(fase)) return bad('fase_projeto_invalida')
  if (resumo.length > 2000) return bad('resumo_projeto_invalido')

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: captureConfig, error: captureConfigError } = await admin
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', 'cpc_captura_publica_ativa')
    .maybeSingle()
  if (captureConfigError) return bad('capture_unavailable', 503)
  if (captureConfig?.valor !== true) return bad('capture_disabled', 503)

  const { data: existing } = await admin
    .from('cpc_leads_publicos')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) return jsonResponse({ ok: true, duplicate: true })

  const rate = await rateLimit(admin, req, email)
  if ('error' in rate) return rate.error

  const { error } = await admin.from('cpc_leads_publicos').insert({
    idempotency_key: idempotencyKey,
    nome_completo: nome,
    email,
    telefone,
    cidade: cidade || null,
    uf: uf || null,
    fase_projeto: fase,
    resumo_projeto: resumo || null,
    consentimento_versao: 'cpc_site_v1',
    origem: 'Site da Mercúrio · CPC',
  })

  if (error?.code === '23505') {
    const { data: duplicate } = await admin
      .from('cpc_leads_publicos')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (duplicate) return jsonResponse({ ok: true, duplicate: true })
  }
  if (error) return bad('lead_capture_failed', 500)

  await registerRateLimit(admin, rate.emailKey, rate.ipKey)
  return jsonResponse({ ok: true })
})

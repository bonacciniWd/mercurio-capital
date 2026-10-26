// supabase/functions/integracao-testar/index.ts
// Fase 15 — Health check real de integrações.
// Body: { chave: string }
// Fluxo:
//   1. valida admin (app_is_admin via token do usuário)
//   2. lê integracoes_config.secrets_requeridas
//   3. verifica presença das secrets no ambiente da edge
//   4. faz um ping leve quando há provedor verificável (timeout 8s)
//   5. grava ultimo_status / ultima_checagem / latencia_ms / ultimo_erro
//
// Status resultante:
//   'pendente'     → secrets obrigatórias ausentes (ainda não configurado)
//   'conectado'    → secrets presentes e ping ok (ou sem ping disponível)
//   'erro'         → secrets presentes mas ping falhou
//   'desconectado' → integração marcada inativa
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

type Status = 'conectado' | 'erro' | 'pendente' | 'desconectado'
type PingResult = { ok: boolean; erro?: string; metadata?: Record<string, unknown> }

// Provedores com verificação automática (ping) disponível.
const PINGAVEIS = new Set(['stripe', 'resend', 'serasa', 'whatsapp', 'clicksign', 'vimeo', 'bacen'])

async function withTimeout(fn: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

function extractVimeoVideoId(payload: unknown): string | null {
  const obj = payload as { uri?: string; link?: string } | null
  const raw = obj?.uri ?? obj?.link ?? ''
  const uriMatch = raw.match(/\/videos\/(\d+)/)
  if (uriMatch) return uriMatch[1]
  const urlMatch = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return urlMatch?.[1] ?? null
}

function safeProviderDetail(value: string, maxLength = 240): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .slice(0, maxLength)
}

// Retorna { ok, erro } — só é chamado quando todas as secrets existem.
async function pingProvider(chave: string): Promise<PingResult> {
  try {
    switch (chave) {
      case 'stripe': {
        const res = await withTimeout((signal) =>
          fetch('https://api.stripe.com/v1/balance', {
            headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
            signal,
          }))
        return res.ok ? { ok: true } : { ok: false, erro: `stripe ${res.status}` }
      }
      case 'resend': {
        const res = await withTimeout((signal) =>
          fetch('https://api.resend.com/domains', {
            headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` },
            signal,
          }))
        return res.ok ? { ok: true } : { ok: false, erro: `resend ${res.status}` }
      }
      case 'serasa': {
        const base = (Deno.env.get('SERASA_API_URL') ?? '').replace(/\/+$/, '')
        const clientId = Deno.env.get('SERASA_CLIENT_ID') ?? Deno.env.get('SERASA_LOGON') ?? ''
        const clientSecret = Deno.env.get('SERASA_CLIENT_SECRET') ?? Deno.env.get('SERASA_SENHA') ?? ''
        const isUat = base === 'https://uat-api.serasaexperian.com.br'
        const isProduction = base === 'https://api.serasaexperian.com.br'
        if ((!isUat && !isProduction) || !clientId || !clientSecret) {
          return { ok: false, erro: 'serasa_url_ou_credenciais_ausentes_invalidas' }
        }
        const basic = btoa(`${clientId}:${clientSecret}`)
        const res = await withTimeout((signal) =>
          fetch(`${base}/security/iam/v1/client-identities/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Basic ${basic}`,
            },
            signal,
            redirect: 'error',
          }))
        return res.ok
          ? { ok: true, metadata: { verification: 'iam_authenticated', reports_tested: false, environment: isUat ? 'uat' : 'producao' } }
          : { ok: false, erro: `serasa_iam_${res.status}` }
      }
      case 'whatsapp': {
        const ver = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0'
        const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
        const tokenWa = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? ''
        const res = await withTimeout((signal) =>
          fetch(`https://graph.facebook.com/${ver}/${phoneId}?fields=verified_name,quality_rating`, {
            headers: { Authorization: `Bearer ${tokenWa}` },
            signal,
          }))
        return res.ok ? { ok: true } : { ok: false, erro: `whatsapp ${res.status}` }
      }
      case 'clicksign': {
        const base = (Deno.env.get('CLICKSIGN_API_URL') ?? 'https://app.clicksign.com').replace(/\/+$/, '')
        const token = Deno.env.get('CLICKSIGN_API_TOKEN') ?? ''
        const res = await withTimeout((signal) =>
          fetch(`${base}/api/v1/templates?access_token=${encodeURIComponent(token)}`, { signal }))
        // 200 ou 401 indicam endpoint acessível; só falha de rede é erro real
        return res.status < 500 ? { ok: res.ok } : { ok: false, erro: `clicksign ${res.status}` }
      }
      case 'vimeo': {
        const token = Deno.env.get('VIMEO_ACCESS_TOKEN') ?? ''
        const createRes = await withTimeout((signal) =>
          fetch('https://api.vimeo.com/me/videos', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.vimeo.*+json;version=3.4',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              upload: { approach: 'tus', size: '1048576' },
              name: 'Mercurio healthcheck upload permission',
              description: 'Criado automaticamente pelo health check; deve ser removido em seguida.',
              privacy: { view: 'nobody' },
            }),
            signal,
          }))
        const text = await createRes.text()
        if (!createRes.ok) {
          return { ok: false, erro: `vimeo_upload_create ${createRes.status}: ${safeProviderDetail(text)}` }
        }

        let payload: unknown = null
        try { payload = text ? JSON.parse(text) : null } catch { payload = null }
        const videoId = extractVimeoVideoId(payload)
        const uploadLink = (payload as { upload?: { upload_link?: string; link?: string } } | null)?.upload?.upload_link
          ?? (payload as { upload?: { upload_link?: string; link?: string } } | null)?.upload?.link

        if (!videoId || !uploadLink) {
          return { ok: false, erro: `vimeo_upload_payload_invalido ${safeProviderDetail(text)}` }
        }

        const deleteRes = await withTimeout((signal) =>
          fetch(`https://api.vimeo.com/videos/${videoId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.vimeo.*+json;version=3.4',
            },
            signal,
          }))
        if (!deleteRes.ok && deleteRes.status !== 204) {
          const deleteText = await deleteRes.text()
          return { ok: false, erro: `vimeo_upload_delete ${deleteRes.status}: ${safeProviderDetail(deleteText)}` }
        }

        return { ok: true }
      }
      case 'bacen': {
        // SCR é acessado via provedor homologado configurável. Verificamos a
        // obtenção de token (oauth2) ou a presença do bearer + endpoint base.
        const base = (Deno.env.get('BACEN_SCR_API_URL') ?? '').replace(/\/+$/, '')
        const mode = (Deno.env.get('BACEN_SCR_AUTH_MODE') ?? 'oauth2').toLowerCase()
        if (!base) return { ok: false, erro: 'BACEN_SCR_API_URL ausente' }
        if (mode === 'bearer') {
          const tok = Deno.env.get('BACEN_SCR_API_TOKEN') ?? ''
          return tok ? { ok: true } : { ok: false, erro: 'BACEN_SCR_API_TOKEN ausente' }
        }
        const tokenUrl = Deno.env.get('BACEN_SCR_TOKEN_URL') || `${base}/oauth/token`
        const res = await withTimeout((signal) =>
          fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: Deno.env.get('BACEN_SCR_CLIENT_ID') ?? '',
              client_secret: Deno.env.get('BACEN_SCR_CLIENT_SECRET') ?? '',
            }),
            signal,
          }))
        return res.ok ? { ok: true } : { ok: false, erro: `bacen ${res.status}` }
      }
      default:
        // Sem ping verificável: presença das secrets já basta
        return { ok: true }
    }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return jsonResponse({ error: 'sem_token' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: isAdmin, error: adminErr } = await userClient.rpc('app_is_admin')
  if (adminErr || isAdmin !== true) return jsonResponse({ error: 'forbidden' }, 403)

  let chave = ''
  try {
    chave = (await req.json())?.chave ?? ''
  } catch {
    return jsonResponse({ error: 'json_invalido' }, 400)
  }
  if (!chave) return jsonResponse({ error: 'chave_obrigatoria' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: cfg, error: cfgErr } = await admin
    .from('integracoes_config')
    .select('chave, secrets_requeridas, ativo')
    .eq('chave', chave)
    .maybeSingle()
  if (cfgErr) return jsonResponse({ error: 'erro_config', detalhe: cfgErr.message }, 500)
  if (!cfg) return jsonResponse({ error: 'integracao_nao_encontrada' }, 404)

  const inicio = Date.now()
  let status: Status
  let erro: string | null = null
  let metricas: Record<string, unknown> | undefined

  const requeridas = (cfg.secrets_requeridas as string[]) ?? []
  const configuredSerasaUrl = (Deno.env.get('SERASA_API_URL') ?? '').replace(/\/+$/, '')
  const faltando = chave === 'serasa'
    ? [
        ...((Deno.env.get('SERASA_CLIENT_ID') ?? Deno.env.get('SERASA_LOGON') ?? '').trim() ? [] : ['SERASA_CLIENT_ID']),
        ...((Deno.env.get('SERASA_CLIENT_SECRET') ?? Deno.env.get('SERASA_SENHA') ?? '').trim() ? [] : ['SERASA_CLIENT_SECRET']),
        ...(configuredSerasaUrl ? [] : ['SERASA_API_URL']),
        ...(configuredSerasaUrl === 'https://api.serasaexperian.com.br' && !Deno.env.get('SERASA_RETAILER_DOCUMENT_ID')
          ? ['SERASA_RETAILER_DOCUMENT_ID'] : []),
      ]
    : requeridas.filter((s) => !(Deno.env.get(s) ?? '').trim())

  if (!cfg.ativo) {
    status = 'desconectado'
  } else if (requeridas.length > 0 && faltando.length > 0) {
    status = 'pendente'
    erro = `secrets ausentes: ${faltando.join(', ')}`
  } else if (!PINGAVEIS.has(chave)) {
    status = 'pendente'
    erro = 'Sem verificação automática — aguardando provisionamento de credenciais.'
  } else {
    const ping = await pingProvider(chave)
    status = ping.ok ? 'conectado' : 'erro'
    erro = ping.erro ?? null
    metricas = ping.metadata
  }

  const latencia = Date.now() - inicio

  const { error: updErr } = await admin
    .from('integracoes_config')
    .update({
      ultimo_status: status,
      ultima_checagem: new Date().toISOString(),
      ultimo_erro: erro,
      latencia_ms: latencia,
      ...(metricas ? { metricas } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('chave', chave)
  if (updErr) return jsonResponse({ error: 'erro_persistencia', detalhe: updErr.message }, 500)

  return jsonResponse({ chave, status, latencia_ms: latencia, erro })
})

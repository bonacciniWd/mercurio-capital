// supabase/functions/vimeo-upload-init/index.ts
// Inicializa upload de video no Vimeo via TUS para aulas da Universidade.
// Fluxo:
//  1) valida JWT e role admin
//  2) cria video no Vimeo (unlisted)
//  3) aplica whitelist de dominios (se configurada)
//  4) retorna upload_link + vimeo_id para o frontend enviar o arquivo direto

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const VIMEO_ACCESS_TOKEN = Deno.env.get('VIMEO_ACCESS_TOKEN') ?? ''
const VIMEO_EMBED_DOMAINS = Deno.env.get('VIMEO_EMBED_DOMAINS') ?? ''

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024
const MAX_UPLOAD_BYTES = (() => {
  const raw = Number(Deno.env.get('VIMEO_MAX_UPLOAD_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_UPLOAD_BYTES
  return Math.floor(raw)
})()

interface Body {
  filename?: string
  size?: number
  content_type?: string
  aula_titulo?: string | null
  curso_id?: string | null
  modulo_id?: string | null
  aula_id?: string | null
}

interface VimeoCreateResponse {
  uri?: string
  link?: string
  upload?: {
    upload_link?: string
    link?: string
  }
}

function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  const withoutProtocol = raw.replace(/^https?:\/\//, '')
  const withoutPath = withoutProtocol.split('/')[0]
  const domain = withoutPath.replace(/\s/g, '')
  if (!domain) return null
  return domain
}

function parseEmbedDomains(raw: string): string[] {
  const value = raw.trim()
  if (!value) return []

  let parts: string[] = []
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        parts = parsed.map((v) => String(v))
      }
    } catch {
      parts = value.slice(1, -1).split(',')
    }
  } else {
    parts = value.split(',')
  }

  const domains = new Set<string>()
  for (const part of parts) {
    const domain = normalizeDomain(part)
    if (domain) domains.add(domain)
  }
  return [...domains]
}

function extractVimeoId(raw: string | undefined): string | null {
  if (!raw) return null
  const str = String(raw)
  const uriMatch = str.match(/\/videos\/(\d+)/)
  if (uriMatch) return uriMatch[1]
  const urlMatch = str.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (urlMatch) return urlMatch[1]
  return null
}

function buildVideoName(body: Body): string {
  const fromAula = (body.aula_titulo ?? '').trim()
  if (fromAula) return fromAula.slice(0, 120)
  const base = (body.filename ?? 'Aula Universidade Mercurio').trim()
  return base.slice(0, 120)
}

function buildDescription(body: Body): string {
  const curso = body.curso_id ?? 'n/a'
  const modulo = body.modulo_id ?? 'n/a'
  const aula = body.aula_id ?? 'novo'
  return `Upload LMS Mercurio | curso=${curso} | modulo=${modulo} | aula=${aula}`
}

function vimeoHeaders(withJsonBody = false): HeadersInit {
  return {
    Authorization: `Bearer ${VIMEO_ACCESS_TOKEN}`,
    Accept: 'application/vnd.vimeo.*+json;version=3.4',
    ...(withJsonBody ? { 'Content-Type': 'application/json' } : {}),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return jsonResponse({ error: 'sem_token' }, 401)

  if (!VIMEO_ACCESS_TOKEN) {
    return jsonResponse({ error: 'vimeo_nao_configurado', detail: 'VIMEO_ACCESS_TOKEN ausente' }, 503)
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: isAdmin, error: adminErr } = await userClient.rpc('app_is_admin')
  if (adminErr || isAdmin !== true) return jsonResponse({ error: 'forbidden' }, 403)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'json_invalido' }, 400)
  }

  const size = Number(body.size ?? 0)
  const filename = String(body.filename ?? '').trim()
  const contentType = String(body.content_type ?? '').trim().toLowerCase()

  if (!filename) return jsonResponse({ error: 'filename_obrigatorio' }, 400)
  if (!Number.isFinite(size) || size <= 0) return jsonResponse({ error: 'size_invalido' }, 400)
  if (size > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: 'arquivo_muito_grande', detail: `limite=${MAX_UPLOAD_BYTES}` }, 413)
  }
  if (!contentType.startsWith('video/')) {
    return jsonResponse({ error: 'content_type_invalido', detail: 'esperado video/*' }, 422)
  }

  const createPayload = {
    upload: { approach: 'tus', size: String(size) },
    name: buildVideoName(body),
    description: buildDescription(body),
    privacy: { view: 'unlisted' },
  }

  const createRes = await fetch('https://api.vimeo.com/me/videos', {
    method: 'POST',
    headers: vimeoHeaders(true),
    body: JSON.stringify(createPayload),
  })

  const createText = await createRes.text()
  if (!createRes.ok) {
    return jsonResponse({
      error: 'vimeo_create_fail',
      detail: createText.slice(0, 800),
      status: createRes.status,
    }, 502)
  }

  let createJson: VimeoCreateResponse = {}
  try {
    createJson = createText ? JSON.parse(createText) as VimeoCreateResponse : {}
  } catch {
    createJson = {}
  }

  const uploadLink = createJson.upload?.upload_link ?? createJson.upload?.link ?? null
  const vimeoId = extractVimeoId(createJson.uri) ?? extractVimeoId(createJson.link)

  if (!uploadLink || !vimeoId) {
    return jsonResponse({ error: 'vimeo_payload_invalido', detail: 'upload_link ou vimeo_id ausente' }, 502)
  }

  const domainsRequested = parseEmbedDomains(VIMEO_EMBED_DOMAINS)
  const domainsApplied: string[] = []
  const domainWarnings: string[] = []

  for (const domain of domainsRequested) {
    try {
      const domainRes = await fetch(`https://api.vimeo.com/videos/${vimeoId}/privacy/domains/${encodeURIComponent(domain)}`, {
        method: 'PUT',
        headers: vimeoHeaders(false),
      })
      if (domainRes.ok || domainRes.status === 204) {
        domainsApplied.push(domain)
      } else {
        const text = await domainRes.text()
        domainWarnings.push(`dominio ${domain} falhou (${domainRes.status}): ${text.slice(0, 120)}`)
      }
    } catch (e) {
      domainWarnings.push(`dominio ${domain} falhou: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (domainsApplied.length > 0) {
    try {
      const patchRes = await fetch(`https://api.vimeo.com/videos/${vimeoId}`, {
        method: 'PATCH',
        headers: vimeoHeaders(true),
        body: JSON.stringify({ privacy: { embed: 'whitelist' } }),
      })
      if (!patchRes.ok) {
        const text = await patchRes.text()
        domainWarnings.push(`nao foi possivel ativar embed whitelist (${patchRes.status}): ${text.slice(0, 120)}`)
      }
    } catch (e) {
      domainWarnings.push(`nao foi possivel ativar embed whitelist: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return jsonResponse({
    vimeo_id: vimeoId,
    uri: createJson.uri ?? null,
    upload_link: uploadLink,
    embed_domains_applied: domainsApplied,
    warnings: domainWarnings,
  })
})

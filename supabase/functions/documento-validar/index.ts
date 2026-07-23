// supabase/functions/documento-validar/index.ts
// Valida CPF/CNPJ via API do Invertexto (https://api.invertexto.com/api-validador-cpf-cnpj)
// com token server-side (nunca exposto no frontend).
// Body: { value: string, type?: 'cpf' | 'cnpj' }
// Retorna: { value, formatted, type, valid }
//
// Segurança:
//   - verify_jwt = true (somente admin ou parceiro aprovado).
//   - Token do Invertexto apenas em env (INVERTEXTO_TOKEN).
//   - PII mascarada em logs.
//
// Códigos HTTP:
//   200 { valid: boolean, ... }        sucesso (mesmo quando valid=false)
//   400 documento_obrigatorio / documento_invalido (formato)
//   401 unauthorized
//   403 forbidden
//   424 invertexto_nao_configurado
//   429 rate_limited
//   502 invertexto_error

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const INVERTEXTO_TOKEN = Deno.env.get('INVERTEXTO_TOKEN') ?? ''
const INVERTEXTO_URL = 'https://api.invertexto.com/v1/validator'

function onlyDigits(v: string): string {
  return (v ?? '').replace(/\D+/g, '')
}

function maskDoc(v: string): string {
  const d = onlyDigits(v)
  if (d.length < 5) return '***'
  return `${d.slice(0, 3)}***${d.slice(-2)}`
}

interface InvertextoResponse {
  value?: string
  formatted?: string
  type?: string
  valid?: boolean
  error?: string
  message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  const { data: ures, error: uerr } = await userClient.auth.getUser()
  if (uerr || !ures.user) return jsonResponse({ error: 'unauthorized' }, 401)

  const appMetadata = (ures.user.app_metadata ?? {}) as Record<string, unknown>
  const role = appMetadata.role
  const approved = appMetadata.approved === true
  const canValidate = role === 'admin' || (role === 'partner' && approved)
  if (!canValidate) return jsonResponse({ error: 'forbidden' }, 403)

  if (INVERTEXTO_TOKEN.length === 0) {
    return jsonResponse({ error: 'invertexto_nao_configurado' }, 424)
  }

  let body: { value?: string; type?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  const digits = onlyDigits(body.value ?? '')
  if (!digits) return jsonResponse({ error: 'documento_obrigatorio' }, 400)
  if (digits.length !== 11 && digits.length !== 14) {
    return jsonResponse({ error: 'documento_invalido' }, 400)
  }

  try {
    const url = `${INVERTEXTO_URL}?value=${encodeURIComponent(digits)}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${INVERTEXTO_TOKEN}`, 'Accept': 'application/json' },
    })

    if (res.status === 429) return jsonResponse({ error: 'rate_limited' }, 429)
    if (res.status === 401) return jsonResponse({ error: 'invertexto_nao_configurado' }, 424)

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      // eslint-disable-next-line no-console
      console.error('[documento-validar] upstream erro', { status: res.status, doc: maskDoc(digits) })
      return jsonResponse({ error: 'invertexto_error', status: res.status, detail }, 502)
    }

    const raw = await res.json() as InvertextoResponse
    const valid = raw.valid === true
    const type = raw.type ?? (digits.length === 11 ? 'cpf' : 'cnpj')

    // eslint-disable-next-line no-console
    console.log('[documento-validar] ok', { doc: maskDoc(digits), type, valid, by: ures.user.id })

    return jsonResponse({
      value: raw.value ?? digits,
      formatted: raw.formatted ?? null,
      type,
      valid,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro_desconhecido'
    // eslint-disable-next-line no-console
    console.error('[documento-validar] falha', { doc: maskDoc(digits), msg })
    return jsonResponse({ error: 'invertexto_error', detail: msg }, 502)
  }
})

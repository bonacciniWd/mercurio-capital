// supabase/functions/cnpj-consultar/index.ts
// Consulta dados cadastrais de CNPJ via API do Invertexto (token server-side).
// Body: { cnpj: string }
// Retorna dados normalizados para autopreenchimento do fluxo PJ do Wizard.
//
// Segurança:
//   - verify_jwt = true (somente admin ou parceiro aprovado).
//   - INVERTEXTO_TOKEN apenas em env; nunca no frontend.
//   - PII/segredos mascarados em logs.
//
// Códigos HTTP:
//   200 { cnpj, razao_social, ... }
//   400 cnpj_obrigatorio / cnpj_invalido
//   401 unauthorized
//   403 forbidden
//   404 cnpj_nao_encontrado
//   424 invertexto_nao_configurado
//   429 rate_limited
//   502 invertexto_error

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const INVERTEXTO_TOKEN = Deno.env.get('INVERTEXTO_TOKEN') ?? ''
const INVERTEXTO_CNPJ_URL = 'https://api.invertexto.com/v1/cnpj'

function onlyDigits(v: string): string {
  return (v ?? '').replace(/\D+/g, '')
}

function maskCnpj(v: string): string {
  const d = onlyDigits(v)
  if (d.length !== 14) return '***'
  return `${d.slice(0, 2)}.***.***/${d.slice(8, 12)}-**`
}

// Acesso tolerante a nomes de campos alternativos.
function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return null
}

interface CnpjRaw {
  cnpj?: string
  razao_social?: string
  nome_fantasia?: string
  data_abertura?: string
  data_fundacao?: string
  natureza_juridica?: string
  porte?: string
  situacao?: string | { descricao?: string; nome?: string }
  cnae_fiscal_descricao?: string
  atividade_principal?: unknown
  email?: string
  telefone?: string
  telefone1?: string
  endereco?: Record<string, unknown>
  [k: string]: unknown
}

function normalizeSituacao(s: CnpjRaw['situacao']): string | null {
  if (!s) return null
  if (typeof s === 'string') return s
  return s.descricao ?? s.nome ?? null
}

function normalizeAtividade(raw: CnpjRaw): string | null {
  if (raw.cnae_fiscal_descricao) return raw.cnae_fiscal_descricao
  const ap = raw.atividade_principal
  if (Array.isArray(ap) && ap.length > 0) {
    const first = ap[0] as Record<string, unknown>
    return (first.text as string) ?? (first.descricao as string) ?? null
  }
  if (ap && typeof ap === 'object') {
    const o = ap as Record<string, unknown>
    return (o.text as string) ?? (o.descricao as string) ?? null
  }
  return null
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
  const canConsult = role === 'admin' || (role === 'partner' && approved)
  if (!canConsult) return jsonResponse({ error: 'forbidden' }, 403)

  if (INVERTEXTO_TOKEN.length === 0) {
    return jsonResponse({ error: 'invertexto_nao_configurado' }, 424)
  }

  let body: { cnpj?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  const digits = onlyDigits(body.cnpj ?? '')
  if (!digits) return jsonResponse({ error: 'cnpj_obrigatorio' }, 400)
  if (digits.length !== 14) return jsonResponse({ error: 'cnpj_invalido' }, 400)

  try {
    const res = await fetch(`${INVERTEXTO_CNPJ_URL}/${digits}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${INVERTEXTO_TOKEN}`, 'Accept': 'application/json' },
    })

    if (res.status === 429) return jsonResponse({ error: 'rate_limited' }, 429)
    if (res.status === 401) return jsonResponse({ error: 'invertexto_nao_configurado' }, 424)
    if (res.status === 404) return jsonResponse({ error: 'cnpj_nao_encontrado' }, 404)

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      // eslint-disable-next-line no-console
      console.error('[cnpj-consultar] upstream erro', { status: res.status, cnpj: maskCnpj(digits) })
      return jsonResponse({ error: 'invertexto_error', status: res.status, detail }, 502)
    }

    const raw = await res.json() as CnpjRaw
    const end = (raw.endereco ?? {}) as Record<string, unknown>

    const normalizado = {
      cnpj: digits,
      razao_social: pick(raw, ['razao_social', 'nome']),
      nome_fantasia: pick(raw, ['nome_fantasia']),
      data_abertura: pick(raw, ['data_inicio', 'data_abertura', 'data_fundacao', 'data_inicio_atividade']),
      tipo_empresa: pick(raw, ['natureza_juridica', 'porte']),
      ramo_atuacao: normalizeAtividade(raw),
      situacao: normalizeSituacao(raw.situacao),
      email: pick(raw, ['email']),
      telefone: pick(raw, ['telefone', 'telefone1']),
      endereco_cep: pick(end, ['cep']),
      endereco_logradouro: pick(end, ['logradouro']),
      endereco_numero: pick(end, ['numero']),
      endereco_complemento: pick(end, ['complemento']),
      endereco_bairro: pick(end, ['bairro']),
      endereco_cidade: pick(end, ['cidade', 'municipio']),
      endereco_estado: pick(end, ['uf', 'estado']),
    }

    // eslint-disable-next-line no-console
    console.log('[cnpj-consultar] ok', { cnpj: maskCnpj(digits), situacao: normalizado.situacao, by: ures.user.id })

    return jsonResponse(normalizado)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro_desconhecido'
    // eslint-disable-next-line no-console
    console.error('[cnpj-consultar] falha', { cnpj: maskCnpj(digits), msg })
    return jsonResponse({ error: 'invertexto_error', detail: msg }, 502)
  }
})

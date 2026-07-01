// supabase/functions/consulta-executar/index.ts
// Fase 6 — Edge genérica para executar consulta externa paga.
// Body: { proposta_id: uuid, tipo: tipo_consulta, payload?: jsonb }
// Fluxo:
//   1. consulta_iniciar() → debita carteira, cria log em_andamento
//   2. chama provedor (Bacen SCR real quando configurado; Serasa real quando configurado)
//   3. consulta_concluir() OU consulta_estornar() conforme resultado
//
// Códigos HTTP:
//   200 sucesso → { log_id, ledger_id, resumo, response, preco_centavos }
//   402 saldo_insuficiente
//   403 wallet_bloqueada / sem acesso
//   404 proposta_nao_encontrada
//   422 preco_nao_configurado
//   502 falha no provedor (após estorno automático)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

interface Body {
  proposta_id: string
  tipo: string
  payload?: Record<string, unknown>
}

// Mock determinístico — substituir por chamadas reais quando credenciais existirem.
// Serasa: usa API real se SERASA_CLIENT_ID + SERASA_CLIENT_SECRET estiverem setados.
// Bacen SCR: usa API real se BACEN_SCR_API_URL + credenciais estiverem setados.

const SERASA_CLIENT_ID     = Deno.env.get('SERASA_CLIENT_ID') ?? ''
const SERASA_CLIENT_SECRET = Deno.env.get('SERASA_CLIENT_SECRET') ?? ''
const SERASA_API_URL       = Deno.env.get('SERASA_API_URL') ?? 'https://api.serasaexperian.com.br'

// ─────────────────────────── Bacen SCR (configurável) ───────────────────────────
// O SCR do Banco Central não expõe API pública direta: o acesso é feito por
// instituição homologada ou por um agregador homologado. Por isso a integração é
// agnóstica de provedor e configurada por ambiente. Suporta 2 modos de auth:
//   - oauth2 (client_credentials, padrão) → igual ao fluxo Serasa
//   - bearer (token estático em BACEN_SCR_API_TOKEN)
const BACEN_SCR_API_URL      = (Deno.env.get('BACEN_SCR_API_URL') ?? '').replace(/\/+$/, '')
const BACEN_SCR_AUTH_MODE    = (Deno.env.get('BACEN_SCR_AUTH_MODE') ?? 'oauth2').toLowerCase()
const BACEN_SCR_CLIENT_ID    = Deno.env.get('BACEN_SCR_CLIENT_ID') ?? ''
const BACEN_SCR_CLIENT_SECRET = Deno.env.get('BACEN_SCR_CLIENT_SECRET') ?? ''
const BACEN_SCR_TOKEN_URL    = Deno.env.get('BACEN_SCR_TOKEN_URL') ?? ''
const BACEN_SCR_API_TOKEN    = Deno.env.get('BACEN_SCR_API_TOKEN') ?? ''
// Segurança de produção: sem mock ativo por padrão. Habilite apenas em staging.
const BACEN_ALLOW_MOCK       = (Deno.env.get('BACEN_ALLOW_MOCK') ?? 'false').toLowerCase() === 'true'

function bacenConfigurado(): boolean {
  if (!BACEN_SCR_API_URL) return false
  if (BACEN_SCR_AUTH_MODE === 'bearer') return !!BACEN_SCR_API_TOKEN
  return !!(BACEN_SCR_CLIENT_ID && BACEN_SCR_CLIENT_SECRET)
}

let _bacenToken: string | null = null
let _bacenTokenExp = 0

async function getBacenToken(): Promise<string> {
  if (BACEN_SCR_AUTH_MODE === 'bearer') return BACEN_SCR_API_TOKEN
  if (_bacenToken && Date.now() < _bacenTokenExp) return _bacenToken
  const tokenUrl = BACEN_SCR_TOKEN_URL || `${BACEN_SCR_API_URL}/oauth/token`
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: BACEN_SCR_CLIENT_ID,
      client_secret: BACEN_SCR_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`Bacen auth ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json() as { access_token: string; expires_in?: number }
  if (!json.access_token) throw new Error('Bacen auth sem access_token')
  _bacenToken = json.access_token
  _bacenTokenExp = Date.now() + ((json.expires_in ?? 300) - 30) * 1000
  return _bacenToken
}

// Extrai o primeiro número finito a partir de uma lista de chaves possíveis.
function pickNumero(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  }
  return null
}

// Converte valor monetário (reais, possivelmente decimal) para centavos inteiros.
function reaisParaCentavos(valor: number | null): number | null {
  if (valor === null) return null
  return Math.round(valor * 100)
}

async function chamarBacen(tipo: string, documento: string): Promise<{
  provedor: string; response: Record<string, unknown>; resumo: Record<string, unknown>
}> {
  const token = await getBacenToken()
  const doc = documento.replace(/\D/g, '')
  const isPJ = tipo === 'bacen_cnpj'
  const endpoint = `${BACEN_SCR_API_URL}/scr/v1/${isPJ ? 'cnpj' : 'cpf'}/${doc}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let res: Response
  try {
    res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) throw new Error(`Bacen SCR ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const data = await res.json() as Record<string, unknown>
  // Normalização defensiva — nomes de campos variam por agregador homologado.
  const totais = (data.totais ?? data.totals ?? data.resumo ?? data) as Record<string, unknown>
  const dividaCentavos =
    pickNumero(totais, ['divida_total_centavos', 'valor_total_centavos']) ??
    reaisParaCentavos(pickNumero(totais, ['divida_total', 'valor_total', 'carteira_total', 'valorVencer']))
  const instituicoes = pickNumero(totais, ['instituicoes', 'qtd_instituicoes', 'quantidadeInstituicoes'])
  const aVencer = reaisParaCentavos(pickNumero(totais, ['a_vencer', 'valorAVencer', 'valor_a_vencer']))
  const vencido = reaisParaCentavos(pickNumero(totais, ['vencido', 'valorVencido', 'valor_vencido']))

  return {
    provedor: 'bacen_scr',
    response: data,
    resumo: {
      status: 'ok',
      totals: {
        divida_total_centavos: dividaCentavos,
        instituicoes,
        a_vencer_centavos: aVencer,
        vencido_centavos: vencido,
      },
    },
  }
}

let _serasaToken: string | null = null
let _serasaTokenExp = 0

async function getSerasaToken(): Promise<string> {
  if (_serasaToken && Date.now() < _serasaTokenExp) return _serasaToken
  const res = await fetch(`${SERASA_API_URL}/security/iam/v1/client-identities/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SERASA_CLIENT_ID,
      client_secret: SERASA_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`Serasa auth ${res.status}: ${await res.text()}`)
  const json = await res.json() as { access_token: string; expires_in: number }
  _serasaToken = json.access_token
  _serasaTokenExp = Date.now() + (json.expires_in - 30) * 1000
  return _serasaToken
}

async function chamarSerasa(tipo: string, payload: Record<string, unknown>): Promise<{
  provedor: string; response: Record<string, unknown>; resumo: Record<string, unknown>
}> {
  const token = await getSerasaToken()
  const doc = (payload.cpf ?? payload.cnpj ?? '') as string
  const isPJ = tipo === 'serasa_pj'
  const endpoint = isPJ
    ? `${SERASA_API_URL}/queries/v1/pj/${doc.replace(/\D/g, '')}/data-return`
    : `${SERASA_API_URL}/queries/v1/pf/${doc.replace(/\D/g, '')}/data-return`
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Serasa ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json() as Record<string, unknown>
  const score = (data.score as Record<string, unknown>)?.['score'] as number | undefined
  return {
    provedor: 'serasa_experian',
    response: data,
    resumo: { status: 'ok', score: score ?? null },
  }
}

async function chamarProvedor(tipo: string, payload: Record<string, unknown>): Promise<{
  provedor: string
  response: Record<string, unknown>
  resumo: Record<string, unknown>
}> {
  const seed = Math.floor(Math.random() * 1000)
  const now = new Date().toISOString()

  switch (tipo) {
    case 'bacen_cpf':
    case 'bacen_cnpj': {
      const documento = String((payload.documento ?? payload.cpf ?? payload.cnpj ?? '')).replace(/\D/g, '')
      // Integração real quando configurada.
      if (bacenConfigurado()) {
        if (!documento) throw new Error('documento_ausente_para_bacen')
        return chamarBacen(tipo, documento)
      }
      // Sem credenciais: só permite mock se explicitamente habilitado (staging).
      if (!BACEN_ALLOW_MOCK) {
        throw new Error('bacen_nao_configurado')
      }
      const valor = 50_000 + seed * 137
      return {
        provedor: 'bacen_scr_mock',
        response: { status: 'ok', tipo, consultado_em: now, payload, totais: { divida_total: valor, instituicoes: 3 + (seed % 5) } },
        resumo: { status: 'ok', totals: { divida_total_centavos: valor, instituicoes: 3 + (seed % 5) } },
      }
    }
    case 'serasa_pf':
    case 'serasa_pj': {
      // Usa API real se credenciais estiverem configuradas
      if (SERASA_CLIENT_ID && SERASA_CLIENT_SECRET) {
        return chamarSerasa(tipo, payload)
      }
      // fallback mock
      const score = 300 + (seed % 700)
      return {
        provedor: 'serasa_mock',
        response: { status: 'ok', tipo, consultado_em: now, payload, score, faixa: score > 700 ? 'A' : score > 500 ? 'B' : 'C' },
        resumo: { status: 'ok', score },
      }
    }
    case 'jusbrasil_cnpj':
    case 'escavador_cnpj': {
      const processos = seed % 12
      return {
        provedor: tipo === 'jusbrasil_cnpj' ? 'jusbrasil_mock' : 'escavador_mock',
        response: { status: 'ok', tipo, consultado_em: now, payload, totals: { processos, ativos: Math.floor(processos / 2) } },
        resumo: { status: 'ok', totals: { processos } },
      }
    }
    case 'ri_digital_matricula': {
      return {
        provedor: 'ri_digital_mock',
        response: { status: 'ok', tipo, consultado_em: now, payload, matricula: { numero: `${10000 + seed}`, oneracoes: seed % 3 } },
        resumo: { status: 'ok', totals: { oneracoes: seed % 3 } },
      }
    }
    case 'nacional_consultas_bens':
    case 'nacional_consultas_certidao': {
      return {
        provedor: 'nacional_consultas_mock',
        response: { status: 'ok', tipo, consultado_em: now, payload, encontrados: seed % 6 },
        resumo: { status: 'ok', totals: { encontrados: seed % 6 } },
      }
    }
    default:
      throw new Error(`tipo_invalido: ${tipo}`)
  }
}

// Resolve o documento (CPF/CNPJ) da proposta server-side. A autorização de acesso
// já foi validada por consulta_iniciar; usamos service_role apenas para leitura do
// documento, sem expor nada ao client. Prioriza o cliente da proposta e cai para o
// proponente principal quando necessário.
async function resolverDocumento(
  service: ReturnType<typeof createClient>,
  propostaId: string,
  tipo: string,
): Promise<string | null> {
  const querPJ = tipo === 'bacen_cnpj'

  const { data: prop } = await service
    .from('propostas')
    .select('cliente:clientes(pessoa_tipo, cpf, cnpj)')
    .eq('id', propostaId)
    .maybeSingle()
  const cliente = (prop as { cliente?: { pessoa_tipo?: string; cpf?: string | null; cnpj?: string | null } } | null)?.cliente
  if (cliente) {
    const doc = querPJ ? cliente.cnpj : cliente.cpf
    const digits = (doc ?? '').replace(/\D/g, '')
    if (digits) return digits
  }

  // Fallback: proponente principal com documento compatível.
  const { data: props } = await service
    .from('proponentes')
    .select('cpf_cnpj, principal')
    .eq('proposta_id', propostaId)
    .order('principal', { ascending: false })
  for (const p of (props ?? []) as Array<{ cpf_cnpj: string | null; principal: boolean }>) {
    const digits = (p.cpf_cnpj ?? '').replace(/\D/g, '')
    if (querPJ && digits.length === 14) return digits
    if (!querPJ && digits.length === 11) return digits
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const service = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : supabase

  let body: Body
  try { body = await req.json() } catch { return jsonResponse({ error: 'invalid_json' }, 400) }
  if (!body.proposta_id || !body.tipo) {
    return jsonResponse({ error: 'campos_obrigatorios', detail: 'proposta_id e tipo' }, 400)
  }

  // 1. consulta_iniciar (debita carteira)
  const { data: ini, error: errIni } = await supabase.rpc('consulta_iniciar', {
    p_proposta_id: body.proposta_id,
    p_tipo: body.tipo,
    p_provedor: null,
    p_request: body.payload ?? {},
  })
  if (errIni) {
    const msg = errIni.message ?? ''
    if (msg.includes('saldo_insuficiente')) return jsonResponse({ error: 'saldo_insuficiente', detail: errIni.details ?? null }, 402)
    if (msg.includes('wallet_bloqueada')) return jsonResponse({ error: 'wallet_bloqueada', detail: errIni.hint ?? null }, 403)
    if (msg.includes('proposta_nao_encontrada')) return jsonResponse({ error: 'proposta_nao_encontrada_ou_sem_acesso' }, 404)
    if (msg.includes('preco_nao_configurado')) return jsonResponse({ error: 'preco_nao_configurado', detail: errIni.details ?? null }, 422)
    return jsonResponse({ error: 'erro_iniciar', detail: msg }, 500)
  }

  const row = Array.isArray(ini) ? ini[0] : ini
  const logId: string = row.log_id
  const ledgerId: string = row.ledger_id
  const preco: number = row.preco_centavos

  // 2. chama provedor
  try {
    // Para consultas Bacen, resolve o documento server-side (não é enviado pelo client).
    const payload: Record<string, unknown> = { ...(body.payload ?? {}) }
    if (body.tipo === 'bacen_cpf' || body.tipo === 'bacen_cnpj') {
      const documento = await resolverDocumento(service, body.proposta_id, body.tipo)
      if (!documento) throw new Error('documento_nao_encontrado_na_proposta')
      payload.documento = documento
    }

    const result = await chamarProvedor(body.tipo, payload)

    // 3a. consulta_concluir
    const { data: done, error: errDone } = await supabase.rpc('consulta_concluir', {
      p_log_id: logId,
      p_response: result.response,
      p_resumo: result.resumo,
      p_provedor: result.provedor,
    })
    if (errDone) throw new Error(errDone.message)

    return jsonResponse({
      log_id: logId,
      ledger_id: ledgerId,
      preco_centavos: preco,
      resumo: result.resumo,
      response: result.response,
      provedor: result.provedor,
      log: done,
    })
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e)
    // 3b. consulta_estornar
    await supabase.rpc('consulta_estornar', { p_log_id: logId, p_motivo: motivo.slice(0, 200) })
    return jsonResponse({ error: 'falha_provedor', detail: motivo, estornado: true, log_id: logId }, 502)
  }
})

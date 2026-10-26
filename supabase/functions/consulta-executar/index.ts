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
import {
  normalizeSerasaReport,
  requestSerasaReport,
  serasaEnvironment,
} from '../_shared/serasa-reports.ts'

interface Body {
  proposta_id: string
  tipo: string
  chave_idempotencia?: string
  autorizacao_id?: string
  payload?: Record<string, unknown>
}

// Mock determinístico — substituir por chamadas reais quando credenciais existirem.
// Serasa: usa API real se client ID/secret estiverem setados.
// `SERASA_LOGON`/`SERASA_SENHA` são aliases aceitos pelo onboarding do provedor.
// Bacen SCR: usa API real se BACEN_SCR_API_URL + credenciais estiverem setados.

const SERASA_CLIENT_ID     = Deno.env.get('SERASA_CLIENT_ID') ?? Deno.env.get('SERASA_LOGON') ?? ''
const SERASA_CLIENT_SECRET = Deno.env.get('SERASA_CLIENT_SECRET') ?? Deno.env.get('SERASA_SENHA') ?? ''
// O ambiente deve ser informado explicitamente para evitar que credenciais de
// homologação sejam usadas acidentalmente contra produção (ou vice-versa).
const SERASA_API_URL       = (Deno.env.get('SERASA_API_URL') ?? '').replace(/\/+$/, '')
// Produção permanece bloqueada até a liberação explícita após a conferência
// das credenciais e da configuração do produto contratado.
const SERASA_PRODUCTION_ENABLED = (Deno.env.get('SERASA_PRODUCTION_ENABLED') ?? 'false').toLowerCase() === 'true'
// Mock is opt-in and must never be enabled in production. Without credentials,
// the consultation is estornada and returned as not configured.

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
    case 'serasa_pj':
      throw new Error('serasa_relatorio_deve_usar_fluxo_autorizado')
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

function documentoValido(documento: string, tipo: 'serasa_pf' | 'serasa_pj'): boolean {
  const digits = documento.replace(/\D/g, '')
  const expectedLength = tipo === 'serasa_pf' ? 11 : 14
  if (digits.length !== expectedLength || new Set(digits).size === 1) return false
  const checkDigit = (base: string, weights: number[]) => {
    const total = [...base].reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0)
    const remainder = total % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  if (tipo === 'serasa_pf') {
    const first = checkDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
    const second = checkDigit(digits.slice(0, 9) + first, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
    return first === Number(digits[9]) && second === Number(digits[10])
  }
  const first = checkDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checkDigit(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(digits[12]) && second === Number(digits[13])
}

function parametrosPjValidos(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const parameters = (value as Record<string, unknown>).reportParameters
  if (!Array.isArray(parameters) || parameters.length !== 1) return false
  const item = parameters[0]
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const parameter = item as Record<string, unknown>
  return parameter.name === 'segmentCode' && typeof parameter.value === 'string' && /^\d{3}$/.test(parameter.value)
}

async function executarSerasaAutorizado(args: {
  req: Request
  body: Body
  supabase: ReturnType<typeof createClient>
  service: ReturnType<typeof createClient>
}): Promise<Response> {
  const { body, supabase, service } = args
  if (body.tipo !== 'serasa_pf' && body.tipo !== 'serasa_pj') return jsonResponse({ error: 'tipo_invalido' }, 400)
  if (!body.chave_idempotencia || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.chave_idempotencia)) {
    return jsonResponse({ error: 'chave_idempotencia_obrigatoria' }, 400)
  }
  if (!body.autorizacao_id) return jsonResponse({ error: 'autorizacao_documentada_obrigatoria' }, 403)

  const ambiente = serasaEnvironment(SERASA_API_URL)
  if (!ambiente) return jsonResponse({ error: 'serasa_ambiente_ou_url_invalida' }, 503)
  if (ambiente === 'producao' && !SERASA_PRODUCTION_ENABLED) {
    return jsonResponse({ error: 'serasa_producao_bloqueada' }, 503)
  }
  if (!SERASA_CLIENT_ID || !SERASA_CLIENT_SECRET) return jsonResponse({ error: 'serasa_nao_configurado' }, 503)
  if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return jsonResponse({ error: 'serasa_runtime_incompleto' }, 503)
  const retailerDocumentId = (Deno.env.get('SERASA_RETAILER_DOCUMENT_ID') ?? '').replace(/\D/g, '')
  if (ambiente === 'producao' && retailerDocumentId.length !== 14) {
    return jsonResponse({ error: 'serasa_cnpj_consultante_ausente' }, 503)
  }

  const [{ data: integration, error: integrationError }, { data: config, error: configError }] = await Promise.all([
    service.from('integracoes_config').select('ativo').eq('chave', 'serasa').maybeSingle(),
    service.from('serasa_relatorios_config').select('ativo, report_pf, report_pj, parametros_pj, versao_normalizador')
      .eq('ambiente', ambiente).maybeSingle(),
  ])
  if (integrationError || configError) return jsonResponse({ error: 'serasa_config_indisponivel' }, 503)
  if (!integration?.ativo || !config?.ativo) return jsonResponse({ error: 'serasa_relatorio_desativado' }, 503)
  if (body.tipo === 'serasa_pj' && !parametrosPjValidos(config.parametros_pj)) {
    return jsonResponse({ error: 'serasa_parametros_pj_pendentes' }, 503)
  }

  const product = body.tipo === 'serasa_pf' ? config.report_pf : config.report_pj
  const expectedProduct = body.tipo === 'serasa_pf'
    ? 'RELATORIO_AVANCADO_TOP_SCORE_PF'
    : 'RELATORIO_AVANCADO_PJ_ANALITICO'
  if (product !== expectedProduct) return jsonResponse({ error: 'serasa_produto_nao_permitido' }, 503)

  const { data: proposal, error: proposalError } = await service
    .from('propostas')
    .select('cliente:clientes(pessoa_tipo, cpf, cnpj)')
    .eq('id', body.proposta_id)
    .maybeSingle()
  if (proposalError) return jsonResponse({ error: 'cadastro_proposta_indisponivel' }, 503)
  const cliente = (proposal as { cliente?: { pessoa_tipo?: string; cpf?: string | null; cnpj?: string | null } | null } | null)?.cliente
  const document = body.tipo === 'serasa_pf' ? cliente?.cpf : cliente?.cnpj
  const expectedPersonType = body.tipo === 'serasa_pf' ? 'PF' : 'PJ'
  if (cliente?.pessoa_tipo !== expectedPersonType || !document || !documentoValido(document, body.tipo)) {
    return jsonResponse({ error: 'documento_titular_invalido' }, 422)
  }

  const { data: startData, error: startError } = await supabase.rpc('consulta_iniciar_serasa', {
    p_proposta_id: body.proposta_id,
    p_tipo: body.tipo,
    p_chave_idempotencia: body.chave_idempotencia,
    p_autorizacao_id: body.autorizacao_id,
    p_ambiente: ambiente,
  })
  if (startError) {
    const message = startError.message ?? ''
    if (message.includes('saldo_insuficiente')) return jsonResponse({ error: 'saldo_insuficiente' }, 402)
    if (message.includes('wallet_bloqueada')) return jsonResponse({ error: 'wallet_bloqueada' }, 403)
    if (message.includes('preco_nao_configurado')) return jsonResponse({ error: 'preco_nao_configurado' }, 422)
    if (message.includes('autorizacao') || message.includes('documento_')) return jsonResponse({ error: 'autorizacao_documento_ou_titular_invalido' }, 403)
    if (message.includes('proposta_nao_encontrada')) return jsonResponse({ error: 'proposta_nao_encontrada_ou_sem_acesso' }, 404)
    if (message.includes('serasa_')) return jsonResponse({ error: 'serasa_relatorio_desativado' }, 503)
    if (message.includes('chave_idempotencia_reutilizada')) return jsonResponse({ error: 'chave_idempotencia_reutilizada' }, 409)
    return jsonResponse({ error: 'erro_iniciar_consulta' }, 500)
  }
  const started = Array.isArray(startData) ? startData[0] : startData
  if (!started?.log_id) return jsonResponse({ error: 'erro_iniciar_consulta' }, 500)

  if (started.reutilizada) {
    if (started.status === 'em_andamento' || started.status === 'reconciliacao_pendente') {
      return jsonResponse({ error: 'consulta_em_reconciliacao', log_id: started.log_id, status: started.status }, 202)
    }
    const { data: previous, error: previousError } = await service.from('logs_consultas')
      .select('resumo, provedor, produto_relatorio, ambiente, preco_centavos, status')
      .eq('id', started.log_id).maybeSingle()
    if (previousError || !previous) return jsonResponse({ error: 'consulta_anterior_indisponivel' }, 503)
    return jsonResponse({ log_id: started.log_id, reused: true, ...previous })
  }

  try {
    const raw = await requestSerasaReport({
      apiUrl: SERASA_API_URL,
      clientId: SERASA_CLIENT_ID,
      clientSecret: SERASA_CLIENT_SECRET,
      document,
      retailerDocumentId: retailerDocumentId || undefined,
      product: product as 'RELATORIO_AVANCADO_TOP_SCORE_PF' | 'RELATORIO_AVANCADO_PJ_ANALITICO',
      reportParameters: body.tipo === 'serasa_pj' ? config.parametros_pj as Record<string, unknown> : undefined,
    })
    const resumo = normalizeSerasaReport(raw, product, config.versao_normalizador)
    const { error: finishError } = await service.rpc('consulta_concluir', {
      p_log_id: started.log_id,
      p_response: resumo,
      p_resumo: resumo,
      p_provedor: 'serasa_experian',
    })
    if (finishError) {
      const { data: persisted } = await service.from('logs_consultas').select('status, resumo')
        .eq('id', started.log_id).maybeSingle()
      if (persisted?.status === 'concluida') {
        return jsonResponse({ log_id: started.log_id, status: 'concluida', resumo: persisted.resumo, reused: true })
      }
      await service.rpc('consulta_marcar_reconciliacao', {
        p_log_id: started.log_id,
        p_motivo: 'resultado_recebido_nao_persistido',
      })
      return jsonResponse({ error: 'resultado_pendente_reconciliacao', log_id: started.log_id }, 503)
    }
    return jsonResponse({
      log_id: started.log_id,
      ledger_id: started.ledger_id,
      preco_centavos: started.preco_centavos,
      status: 'concluida',
      provedor: 'serasa_experian',
      ambiente,
      produto_relatorio: product,
      resumo,
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'falha_provedor'
    const statusCode = Number(code.match(/serasa_(?:auth|report)_(\d+)/)?.[1] ?? 0)
    if (!statusCode || statusCode >= 500) {
      const { error: reconcileError } = await service.rpc('consulta_marcar_reconciliacao', {
        p_log_id: started.log_id,
        p_motivo: code.slice(0, 160),
      })
      if (reconcileError) return jsonResponse({ error: 'consulta_em_reconciliacao', log_id: started.log_id }, 503)
      return jsonResponse({ error: 'consulta_em_reconciliacao', log_id: started.log_id, status: 'reconciliacao_pendente' }, 202)
    }
    const { error: refundError } = await service.rpc('consulta_estornar', {
      p_log_id: started.log_id,
      p_motivo: code.slice(0, 160),
    })
    if (refundError) return jsonResponse({ error: 'estorno_pendente_reconciliacao', log_id: started.log_id }, 503)
    return jsonResponse({ error: 'falha_provedor', status_serasa: statusCode, estornado: true, log_id: started.log_id }, 502)
  }
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

  if (body.tipo === 'serasa_pf' || body.tipo === 'serasa_pj') {
    return executarSerasaAutorizado({ req, body, supabase, service })
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

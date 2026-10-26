import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { calculatePublicAmortization, type PublicExtraPlan } from '../_shared/amortization.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PROPERTY_TYPES = new Set([
  'casa', 'casa_condominio', 'apartamento', 'comercial', 'terreno',
  'terreno_condominio', 'predio', 'galpao', 'fabrica', 'outros',
])
const PROPERTY_STATUSES = new Set(['quitado', 'financiado'])
const OBJECTIVES = new Set(['Quitar dívidas', 'Investir', 'Capital de giro', 'Outros'])
const INCOME_TYPES = new Set(['CLT', 'Autônomo', 'Empresário', 'Aposentado'])
const HIRING_TIMES = new Set(['Imediatamente', 'Em até 1 mês', 'Em até 3 meses', 'Em até 6 meses', 'Só estou simulando'])
const SOURCES = new Set(['Google', 'Facebook ou Instagram', 'Indicação', 'Site da Mercúrio', 'Outro'])
const AMORTIZATION_PERIODS = new Set(['mensal', 'anual'])
const AMORTIZATION_SYSTEMS = new Set(['price', 'sac'])
const MIN_SIMULATION_CREDIT = 400_000
const PROPERTY_MAX_LTV: Record<string, number> = {
  apartamento: 0.6,
  casa: 0.5,
  casa_condominio: 0.5,
  comercial: 0.4,
  predio: 0.4,
  galpao: 0.4,
  fabrica: 0.4,
  terreno: 0.3,
  terreno_condominio: 0.3,
  outros: 0.4,
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const first = forwarded.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

function digits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

function text(value: unknown, max = 160): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function bad(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

async function prepareRateLimit(admin: SupabaseClient, req: Request, email: string) {
  let max = 3
  let janelaMin = 60
  try {
    const { data: config } = await admin
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'rate_limit_simulador_publico')
      .maybeSingle()
    const value = config?.valor as { max?: number; janela_min?: number } | null
    if (value?.max && value.max > 0) max = value.max
    if (value?.janela_min && value.janela_min > 0) janelaMin = value.janela_min
  } catch {
    // Defaults conservadores quando a configuração opcional não está disponível.
  }

  const emailKey = `simulador-publico::email::${email}`
  const ipKey = `simulador-publico::ip::${clientIp(req)}`
  const janela = `${janelaMin} minutes`
  const [emailPeek, ipPeek] = await Promise.all([
    admin.rpc('rate_limit_peek', { p_chave: emailKey, p_limite: max, p_janela: janela }),
    admin.rpc('rate_limit_peek', { p_chave: ipKey, p_limite: max * 3, p_janela: janela }),
  ])
  if (emailPeek.error || ipPeek.error) return { error: jsonResponse({ error: 'rate_check_failed' }, 500) }
  if (emailPeek.data === false || ipPeek.data === false) return { error: jsonResponse({ error: 'rate_limited', retry_after_min: janelaMin }, 429) }
  return { emailKey, ipKey, janelaMin }
}

async function registerRateLimit(admin: SupabaseClient, emailKey: string, ipKey: string) {
  await Promise.all([
    admin.rpc('rate_limit_register', { p_chave: emailKey }),
    admin.rpc('rate_limit_register', { p_chave: ipKey }),
  ])
}

function validDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function captureErrorResponse(error: { message?: string } | null) {
  const message = error?.message ?? ''
  if (/invalido|obrigator|acima_do_limite|valor_imovel|valor_credito|cep_|renda_|prazo|periodicidade|sistema|quantidade|taxa|parcela|plano|data_|garantia/i.test(message)) {
    return bad('dados_invalidos')
  }
  return jsonResponse({ error: 'lead_capture_failed' }, 500)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return bad('method_not_allowed', 405)

  const raw = await req.text()
  if (raw.length > 20_000) return bad('payload_too_large', 413)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return bad('invalid_json')
  }

  if (text(body.website, 80)) return bad('invalid_request')

  const tipoSimulacao = text(body.tipo_simulacao, 30) || 'home_equity'
  const idempotencyKey = text(body.idempotency_key, 80)
  const nome = text(body.nome_completo)
  const email = text(body.email, 254).toLowerCase()
  const telefone = digits(body.telefone)
  const cep = digits(body.cep)
  const tipoImovel = text(body.tipo_imovel, 40).toLowerCase()
  const situacaoImovel = text(body.situacao_imovel, 20).toLowerCase()
  const renda = body.renda_mensal === null || body.renda_mensal === undefined || body.renda_mensal === '' ? null : Number(body.renda_mensal)
  const objetivo = text(body.objetivo_credito, 80)
  const tipoRenda = text(body.tipo_renda, 40)
  const prazoContratacao = text(body.prazo_contratacao, 40)
  const origem = text(body.origem, 80)

  if (!idempotencyKey || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return bad('idempotency_key_invalida')
  if (nome.length < 3 || nome.length > 160) return bad('nome_invalido')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('email_invalido')
  if (telefone.length < 10 || telefone.length > 11) return bad('telefone_invalido')
  if (renda !== null && (!Number.isFinite(renda) || renda < 0)) return bad('renda_invalida')
  if (body.consentimento !== true) return bad('consentimento_obrigatorio')
  if (!OBJECTIVES.has(objetivo)) return bad('objetivo_invalido')
  if (!INCOME_TYPES.has(tipoRenda)) return bad('tipo_renda_invalido')
  if (!HIRING_TIMES.has(prazoContratacao)) return bad('prazo_contratacao_invalido')
  if (origem && !SOURCES.has(origem)) return bad('origem_invalida')
  if (!['home_equity', 'amortizacao'].includes(tipoSimulacao)) return bad('tipo_simulacao_invalido')
  if (cep.length !== 8) return bad('cep_invalido')
  if (!PROPERTY_TYPES.has(tipoImovel)) return bad('tipo_imovel_invalido')
  if (!PROPERTY_STATUSES.has(situacaoImovel)) return bad('situacao_imovel_invalida')

  const valorCredito = Number(body.valor_credito ?? body.valor_emprestimo)
  if (!Number.isFinite(valorCredito) || valorCredito < MIN_SIMULATION_CREDIT) return bad('valor_credito_minimo_400000')
  const valorImovel = tipoSimulacao === 'home_equity' ? Number(body.valor_imovel) : null
  if (tipoSimulacao === 'home_equity') {
    if (!Number.isFinite(valorImovel)) return bad('valores_invalidos')
    const maxLtv = PROPERTY_MAX_LTV[tipoImovel] ?? 0.4
    if (valorCredito > Math.floor((valorImovel as number) * maxLtv)) return bad('valor_credito_acima_ltv')
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const rateLimit = await prepareRateLimit(admin, req, email)
  if ('error' in rateLimit) return rateLimit.error

  let data: unknown
  let error: { message?: string } | null = null

  if (tipoSimulacao === 'amortizacao') {
    const dataInicio = text(body.data_inicio, 10)
    const periodicidade = text(body.periodicidade_juros, 10)
    const sistema = text(body.sistema_amortizacao, 10)
    const quantidade = Number(body.quantidade_parcelas ?? body.prazo_meses)
    const prazo = Number(body.prazo_meses ?? body.quantidade_parcelas)
    const taxaInformada = Number(body.taxa_juros_informada)
    const taxaMensal = Number(body.taxa_juros_mensal)
    const primeiraParcela = Number(body.primeira_parcela)
    const ultimaParcela = Number(body.ultima_parcela)
    const totalPago = Number(body.total_pago)
    const totalJuros = Number(body.total_juros)
    const rawPlans = body.planos_amortizacao === undefined ? [] : body.planos_amortizacao
    if (!validDateInput(dataInicio)) return bad('data_inicio_invalida')
    if (!AMORTIZATION_PERIODS.has(periodicidade)) return bad('periodicidade_invalida')
    if (!AMORTIZATION_SYSTEMS.has(sistema)) return bad('sistema_amortizacao_invalido')
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 320 || quantidade !== prazo) return bad('quantidade_parcelas_invalida')
    if (!Number.isFinite(taxaInformada) || taxaInformada < 0 || taxaInformada > 100 || !Number.isFinite(taxaMensal) || taxaMensal < 0) return bad('taxa_invalida')
    if (![primeiraParcela, ultimaParcela, totalPago, totalJuros].every(value => Number.isFinite(value) && value >= 0)) return bad('parcelas_invalidas')
    if (valorCredito < MIN_SIMULATION_CREDIT) return bad('valor_credito_minimo_400000')
    if (!Array.isArray(rawPlans) || rawPlans.length > 10) return bad('planos_amortizacao_invalidos')
    const plans: PublicExtraPlan[] = []
    for (const rawPlan of rawPlans) {
      if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) return bad('plano_amortizacao_invalido')
      const candidate = rawPlan as Record<string, unknown>
      const amount = Number(candidate.valor_extra)
      const objective = candidate.objetivo
      const frequency = candidate.frequencia
      const after = Number(candidate.apos_parcela)
      if (!Number.isFinite(amount) || amount <= 0 || amount > valorCredito) return bad('plano_valor_invalido')
      if (objective !== 'prazo' && objective !== 'parcela') return bad('plano_objetivo_invalido')
      if (frequency !== 'unica' && frequency !== 'mensal') return bad('plano_frequencia_invalida')
      if (!Number.isInteger(after) || after < 1 || after > prazo) return bad('plano_parcela_invalida')
      plans.push({ valor_extra: amount, objetivo: objective, frequencia: frequency, apos_parcela: after })
    }

    const computedComparison = calculatePublicAmortization({
      valor: valorCredito,
      prazo,
      taxaMensal: taxaMensal / 100,
      sistema: sistema as 'price' | 'sac',
      dataInicio,
      planos: plans,
    })

    const response = await admin.rpc('capture_public_simulacao_amortizacao_lead_v2', {
      p_idempotency_key: idempotencyKey,
      p_nome_completo: nome,
      p_email: email,
      p_telefone: telefone,
      p_valor_credito: valorCredito,
      p_prazo_meses: prazo,
      p_data_inicio: dataInicio,
      p_taxa_juros_informada: taxaInformada,
      p_periodicidade_juros: periodicidade,
      p_sistema_amortizacao: sistema,
      p_quantidade_parcelas: quantidade,
      p_taxa_juros_mensal: taxaMensal,
      p_primeira_parcela: primeiraParcela,
      p_ultima_parcela: ultimaParcela,
      p_total_pago: totalPago,
      p_total_juros: totalJuros,
      p_tipo_imovel: tipoImovel,
      p_situacao_imovel: situacaoImovel,
      p_cep: cep,
      p_renda_mensal: renda,
      p_objetivo_credito: objetivo,
      p_tipo_renda: tipoRenda,
      p_prazo_contratacao: prazoContratacao,
      p_origem: origem || null,
      p_consentimento_versao: 'simulador_publico_v2',
      p_planos_amortizacao: plans,
      p_resultado_com_amortizacao: computedComparison,
    })
    data = response.data
    error = response.error
  } else {
    const response = await admin.rpc('capture_public_simulacao_lead', {
      p_idempotency_key: idempotencyKey,
      p_nome_completo: nome,
      p_email: email,
      p_telefone: telefone,
      p_valor_imovel: valorImovel as number,
      p_valor_credito: valorCredito,
      p_tipo_imovel: tipoImovel,
      p_situacao_imovel: situacaoImovel,
      p_cep: cep,
      p_renda_mensal: renda,
      p_objetivo_credito: objetivo,
      p_tipo_renda: tipoRenda,
      p_prazo_contratacao: prazoContratacao,
      p_origem: origem || null,
      p_consentimento_versao: 'simulador_publico_v2',
    })
    data = response.data
    error = response.error
  }

  if (error) return captureErrorResponse(error)
  await registerRateLimit(admin, rateLimit.emailKey, rateLimit.ipKey)
  const result = (data ?? {}) as Record<string, unknown>
  return jsonResponse({
    ok: true,
    lead_id: result.lead_id,
    created: result.created !== false,
    parcela_estimada: result.parcela_estimada,
    ltv: result.ltv,
    email_prospect: result.email_prospect,
    email_interno: result.email_interno,
  })
})

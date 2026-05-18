// supabase/functions/consulta-executar/index.ts
// Fase 6 — Edge genérica para executar consulta externa paga.
// Body: { proposta_id: uuid, tipo: tipo_consulta, payload?: jsonb }
// Fluxo:
//   1. consulta_iniciar() → debita carteira, cria log em_andamento
//   2. chama provedor (mock se sem credenciais)
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
async function chamarProvedor(tipo: string, payload: Record<string, unknown>): Promise<{
  provedor: string
  response: Record<string, unknown>
  resumo: Record<string, unknown>
}> {
  // Suporte a credenciais: se variáveis de ambiente estiverem setadas, chamar real.
  // Por enquanto todos rodam em modo mock.
  const seed = Math.floor(Math.random() * 1000)
  const now = new Date().toISOString()

  switch (tipo) {
    case 'bacen_cpf':
    case 'bacen_cnpj': {
      const valor = 50_000 + seed * 137
      return {
        provedor: 'bacen_scr_mock',
        response: { status: 'ok', tipo, consultado_em: now, payload, totais: { divida_total: valor, instituicoes: 3 + (seed % 5) } },
        resumo: { status: 'ok', totals: { divida_total_centavos: valor, instituicoes: 3 + (seed % 5) } },
      }
    }
    case 'serasa_pf':
    case 'serasa_pj': {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

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
    const result = await chamarProvedor(body.tipo, body.payload ?? {})

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

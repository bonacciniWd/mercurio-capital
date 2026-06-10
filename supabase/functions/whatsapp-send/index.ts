// supabase/functions/whatsapp-send/index.ts
// Fase 15 — Envio de mensagens WhatsApp via Cloud API oficial (Meta / Graph API).
// Substitui a antiga edge `evolution-whatsapp`.
//
// Body: {
//   telefone: string,                 // E.164 ou nacional; normalizado p/ dígitos
//   corpo?: string,                   // texto livre (válido apenas na janela de 24h)
//   template_codigo?: string,         // busca em templates_mensagem (canal whatsapp)
//   variaveis?: Record<string,string>,// interpolação {{chave}}
//   template?: {                      // envio direto de template aprovado na Meta
//     name: string, lang?: string,
//     params?: string[]               // parâmetros do corpo ({{1}},{{2}}...)
//   },
//   referencia_tipo?: string,
//   referencia_id?: string
// }
// Fluxo:
//   1. valida admin (app_is_admin via token do usuário)
//   2. resolve corpo (template_mensagem + variáveis) ou usa template Meta
//   3. insere whatsapp_mensagens (pendente)
//   4. envia via Graph API se WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID existirem,
//      senão marca como enviado em modo dev (mock) — mesma filosofia do Serasa
//
// Nota sobre a janela de 24h: o WhatsApp só permite texto livre dentro de 24h após a
// última mensagem do cliente. Para iniciar conversa (magic link, status, etc.) use um
// template aprovado (campo `template`). Fora da janela, o texto livre retorna erro da Meta.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? ''
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
const WHATSAPP_API_VERSION = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0'

interface TemplateSend {
  name: string
  lang?: string
  params?: string[]
}
interface Body {
  telefone?: string
  corpo?: string
  template_codigo?: string
  variaveis?: Record<string, string>
  template?: TemplateSend
  referencia_tipo?: string
  referencia_id?: string
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => vars[k] ?? '')
}

function graphUrl(): string {
  return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
}

function buildPayload(telefone: string, corpo: string, template?: TemplateSend): Record<string, unknown> {
  if (template?.name) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefone,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.lang ?? 'pt_BR' },
        ...(template.params && template.params.length > 0
          ? {
              components: [
                { type: 'body', parameters: template.params.map((t) => ({ type: 'text', text: t })) },
              ],
            }
          : {}),
      },
    }
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefone,
    type: 'text',
    text: { preview_url: false, body: corpo },
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

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'json_invalido' }, 400)
  }

  const telefone = (body.telefone ?? '').replace(/\D/g, '')
  if (telefone.length < 10) return jsonResponse({ error: 'telefone_invalido' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Resolve corpo a partir de template_mensagem, se informado
  let corpo = (body.corpo ?? '').trim()
  if (!corpo && body.template_codigo) {
    const { data: tpl, error: tplErr } = await admin
      .from('templates_mensagem')
      .select('corpo')
      .eq('codigo', body.template_codigo)
      .eq('canal', 'whatsapp')
      .eq('ativo', true)
      .maybeSingle()
    if (tplErr) return jsonResponse({ error: 'erro_template', detalhe: tplErr.message }, 500)
    if (!tpl) return jsonResponse({ error: 'template_nao_encontrado' }, 404)
    corpo = interpolate(tpl.corpo as string, body.variaveis ?? {})
  }
  if (!corpo && !body.template?.name) return jsonResponse({ error: 'corpo_vazio' }, 400)

  // Persiste a mensagem como pendente
  const { data: msg, error: insErr } = await admin
    .from('whatsapp_mensagens')
    .insert({
      telefone,
      corpo: corpo || `[template:${body.template?.name}]`,
      template_codigo: body.template_codigo ?? body.template?.name ?? null,
      referencia_tipo: body.referencia_tipo ?? null,
      referencia_id: body.referencia_id ?? null,
      status: 'pendente',
    })
    .select('id')
    .single()
  if (insErr || !msg) return jsonResponse({ error: 'erro_persistencia', detalhe: insErr?.message }, 500)

  const mensagemId = msg.id as string

  // Modo dev (sem credenciais): marca como enviado sem chamar a Cloud API
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    await admin
      .from('whatsapp_mensagens')
      .update({
        status: 'enviado',
        enviado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        metadata: { dev_mode: true },
      })
      .eq('id', mensagemId)
    return jsonResponse({ mensagem_id: mensagemId, status: 'enviado', dev_mode: true })
  }

  // Envio real via Graph API
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    const res = await fetch(graphUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(buildPayload(telefone, corpo, body.template)),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detalhe = JSON.stringify(payload).slice(0, 500)
      await admin
        .from('whatsapp_mensagens')
        .update({ status: 'erro', erro: `whatsapp ${res.status}: ${detalhe}`, atualizado_em: new Date().toISOString() })
        .eq('id', mensagemId)
      return jsonResponse({ error: 'falha_provedor', status: res.status, detalhe }, 502)
    }

    const wamid = (payload?.messages?.[0]?.id as string | undefined) ?? null

    await admin
      .from('whatsapp_mensagens')
      .update({
        status: 'enviado',
        evolution_message_id: wamid,
        enviado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        metadata: payload,
      })
      .eq('id', mensagemId)

    return jsonResponse({ mensagem_id: mensagemId, status: 'enviado', message_id: wamid })
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : String(e)
    await admin
      .from('whatsapp_mensagens')
      .update({ status: 'erro', erro: detalhe.slice(0, 500), atualizado_em: new Date().toISOString() })
      .eq('id', mensagemId)
    return jsonResponse({ error: 'falha_provedor', detalhe }, 502)
  }
})

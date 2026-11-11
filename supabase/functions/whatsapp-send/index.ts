// Administrative/session sends are queued once. Only the authenticated worker delivers.
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { adminIdentity, readBody, service, settings } from '../_shared/whatsapp-runtime.ts'
import { deliveryAllowed, templatePayload, type Outbound } from '../_shared/whatsapp-delivery.ts'
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)
  try {
    const { user, client } = await adminIdentity(req, false); const b = await readBody(req, 16000); const cfg = await settings()
    if (!Deno.env.get('WHATSAPP_ACCESS_TOKEN')) return jsonResponse({ error: 'credenciais_envio_ausentes' }, 503)
    if (typeof b.idempotency_key !== 'string' || !/^[\w-]{8,80}$/.test(b.idempotency_key)) return jsonResponse({ error: 'idempotency_key_obrigatoria' }, 400)
    let row: Outbound
    if (b.atendimento_id) {
      const permission = await client.rpc('whatsapp_pode_atender', { p_id: b.atendimento_id })
      if (permission.error || permission.data !== true) return jsonResponse({ error: 'forbidden' }, 403)
      const { data: a, error } = await service.from('whatsapp_atendimentos').select('*').eq('id', b.atendimento_id).single()
      if (error || !a || a.estado !== 'humano' || a.responsavel_id !== user.id) return jsonResponse({ error: 'assuma_o_atendimento' }, 409)
      if (typeof b.corpo !== 'string' || !b.corpo.trim() || b.corpo.length > 2000) return jsonResponse({ error: 'mensagem_invalida' }, 400)
      row = { telefone: a.sender_phone, corpo: b.corpo.trim(), atendimento_id: a.id }
    } else {
      const full = await client.rpc('app_is_admin_full'); if (full.error || full.data !== true) return jsonResponse({ error: 'forbidden' }, 403)
      const { data: t, error } = await service.from('templates_mensagem').select('whatsapp_versao_id').eq('codigo', b.template_codigo).eq('canal', 'whatsapp').eq('ativo', true).single()
      if (error || !t?.whatsapp_versao_id || typeof b.usuario_id !== 'string') return jsonResponse({ error: 'template_e_titular_obrigatorios' }, 400)
      const { data: c } = await service.from('whatsapp_consentimentos').select('telefone').eq('usuario_id', b.usuario_id).eq('finalidade', 'notificacoes').eq('estado', 'autorizado').eq('phone_number_id', cfg.phone_number_id).single()
      if (!c) return jsonResponse({ error: 'optin_ausente' }, 409)
      const built = await templatePayload(t.whatsapp_versao_id, (b.variaveis ?? {}) as Record<string, string>)
      row = { telefone: c.telefone, corpo: built.corpo, usuario_id: b.usuario_id, template_versao_id: t.whatsapp_versao_id, payload_envio: built.payload }
    }
    const reason = await deliveryAllowed(row, cfg); if (reason) return jsonResponse({ error: reason }, 409)
    const key = `admin:${user.id}:${b.idempotency_key}`
    const result = await service.from('whatsapp_mensagens').upsert({ ...row, status: 'pendente', idempotency_key: key, origem: 'admin', solicitado_por: user.id }, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id').maybeSingle()
    if (result.error) return jsonResponse({ error: 'fila_indisponivel' }, 503)
    const existing = result.data ?? (await service.from('whatsapp_mensagens').select('id').eq('idempotency_key', key).single()).data
    return jsonResponse({ mensagem_id: existing?.id, status: 'pendente' }, 202)
  } catch (e) {
    const m = e instanceof Error ? e.message : ''; return jsonResponse({ error: ['unauthorized', 'forbidden'].includes(m) ? m : 'requisicao_invalida' }, m === 'unauthorized' ? 401 : m === 'forbidden' ? 403 : 400)
  }
})

import { approvedMetaTemplate } from '../_shared/whatsapp-meta.ts'
import { service, workerIdentity, settings, graphRequest, requireResult } from '../_shared/whatsapp-runtime.ts'
import { deliveryAllowed, type Outbound } from '../_shared/whatsapp-delivery.ts'
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  if (!await workerIdentity(req)) return new Response('unauthorized', { status: 401 })
  try {
    const cfg = await settings()
    if (!cfg.ativo || cfg.envio_habilitado !== true) return Response.json({ error: 'envio_desativado' }, { status: 409 })
    const phone = String(cfg.phone_number_id || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '')
    if (!Deno.env.get('WHATSAPP_ACCESS_TOKEN') || !/^\d+$/.test(phone)) return Response.json({ error: 'credenciais_envio_ausentes' }, { status: 503 })
    // Do not reserve the queue if configuration/credentials are unavailable.
    const rows = requireResult(await service.rpc('whatsapp_outbox_pull', { p_limit: 20 })) as (Outbound & { id: string })[]
    let sent = 0; let blocked = 0; let uncertain = 0
    for (const row of rows) {
      if (row.whatsapp_evento_id && row.template_versao_id) {
        const valid = requireResult(await service.rpc('whatsapp_outbox_destinatario_valido', { p_id: row.id }))
        if (valid !== true) { requireResult(await service.rpc('whatsapp_mensagem_marcar', { p_id: row.id, p_status: 'bloqueado', p_erro: 'vinculo_destinatario_alterado' })); blocked++; continue }
      }
      if (row.template_versao_id) {
        const local = requireResult(await service.from('whatsapp_template_versoes').select('*').eq('id', row.template_versao_id).single())
        try {
          if (!local?.meta_template_id) throw new Error('template_sem_id')
          const remote = await graphRequest(local.meta_template_id, 'GET', undefined, { fields: 'id,name,language,status,category,components' })
          requireResult(await service.from('whatsapp_template_versoes').update({ estado_meta: approvedMetaTemplate(local, remote) ? remote.status : 'DIVERGENTE', sincronizado_em: new Date().toISOString() }).eq('id', local.id))
        } catch { requireResult(await service.rpc('whatsapp_mensagem_marcar', { p_id: row.id, p_status: 'bloqueado', p_erro: 'sincronizacao_meta_indisponivel' })); blocked++; continue }
      }
      const reason = await deliveryAllowed(row, cfg)
      if (reason) { requireResult(await service.rpc('whatsapp_mensagem_marcar', { p_id: row.id, p_status: 'bloqueado', p_erro: reason })); blocked++; continue }
      // Enforce configurable limits across workers through an atomic database RPC.
      const permit = requireResult(await service.rpc('whatsapp_envio_permitir', { p_id: row.id }))
      if (!permit) { requireResult(await service.rpc('whatsapp_mensagem_marcar', { p_id: row.id, p_status: 'bloqueado', p_erro: 'limite_ou_horario' })); blocked++; continue }
      try {
        const payload = row.payload_envio ?? { type: 'text', text: { preview_url: false, body: row.corpo } }
        const result = await graphRequest(`${phone}/messages`, 'POST', { ...payload, messaging_product: 'whatsapp', recipient_type: 'individual', to: row.telefone.replace(/\D/g, '') })
        const id = result?.messages?.[0]?.id
        if (typeof id !== 'string' || !id) throw new Error('resposta_sem_id')
        requireResult(await service.rpc('whatsapp_mensagem_marcar', { p_id: row.id, p_status: 'enviado', p_evolution_id: id })); sent++
      } catch (error) {
        // HTTP rejections are definitive; transport/timeout errors require reconciliation.
        const message = error instanceof Error ? error.message : ''
        const definitive = /^meta_http_4\d\d_codigo_/.test(message)
        requireResult(await service.rpc('whatsapp_mensagem_marcar', { p_id: row.id, p_status: definitive ? 'erro' : 'incerto', p_erro: definitive ? message : 'resultado_incerto_reconciliar' })); uncertain++
      }
    }
    return Response.json({ picked: rows.length, sent, blocked, uncertain })
  } catch { return Response.json({ error: 'dispatcher_indisponivel' }, { status: 503 }) }
})

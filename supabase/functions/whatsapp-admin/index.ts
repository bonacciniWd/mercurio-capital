import { approvedMetaTemplate, matchMetaTemplate } from '../_shared/whatsapp-meta.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { adminIdentity, service, readBody, requireResult, hash, graphRequest, settings, audit } from '../_shared/whatsapp-runtime.ts'
import { validateGraph, traceGraph, compileNativeFlow, type Graph } from '../_shared/whatsapp-flow.ts'
const fail = (message: string, status = 400) => jsonResponse({ error: message }, status)
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('method_not_allowed', 405)
  try {
    const { user, client } = await adminIdentity(req, false)
    const b = await readBody(req); const action = String(b.action ?? '')
    const full = requireResult(await client.rpc('app_is_admin_full')) === true
    if (['assumir', 'encerrar', 'retomar'].includes(action)) {
      const a = requireResult(await client.from('whatsapp_atendimentos').select('*').eq('id', b.id).single())
      if (!a || (!full && a.responsavel_id !== user.id)) return fail('forbidden', 403)
      if (action !== 'assumir' && a.responsavel_id !== user.id) return fail('atendimento_de_outro_operador', 409)
      if (a.estado === 'optout') return fail('optout', 409)
      const patch = { estado: action === 'assumir' ? 'humano' : action === 'retomar' ? 'bot' : 'encerrado', responsavel_id: user.id, no_atual_id: action === 'retomar' ? null : a.no_atual_id }
      requireResult(await service.rpc('whatsapp_operador_estado', { p_id: a.id, p_actor: user.id, p_estado: patch.estado, p_esperado: a.estado, p_updated: a.updated_at }))
      return jsonResponse({ ok: true })
    }
    if (!full) return fail('forbidden', 403)
    if (action === 'vincular_contexto') {
      if (b.identidade_verificada !== true || typeof b.email !== 'string') return fail('confirme_identidade_por_canal_autenticado')
      requireResult(await service.rpc('whatsapp_vincular', { p_id: b.id, p_email: b.email, p_proposta: b.proposta_id || null, p_actor: user.id }))
      return jsonResponse({ ok: true })
    }
    if (action === 'registrar_autorizacao') {
      requireResult(await service.rpc('whatsapp_autorizacao_registrar', { p_id: b.id, p_actor: user.id }))
      return jsonResponse({ ok: true })
    }
    if (['validar_fluxo', 'simular_fluxo', 'salvar_fluxo', 'publicar_fluxo'].includes(action)) {
      const graph = b.graph as Graph; const mode = String(b.mode); const errors = validateGraph(graph, mode)
      if (errors.length) return jsonResponse({ errors }, 400)
      if (action === 'validar_fluxo') return jsonResponse({ ok: true })
      if (action === 'simular_fluxo') {
        const context = { evento: String(b.evento ?? ''), status: String(b.status ?? ''), produto: String(b.produto ?? '') }
        return jsonResponse({ caminho: traceGraph(graph, mode, context).map(n => ({ id: n.id, kind: n.data.kind, label: n.data.label })), simulado: true })
      }
      const id = requireResult(await service.rpc('whatsapp_fluxo_salvar', { p_id: b.id || null, p_nome: b.name, p_modo: mode, p_graph: graph, p_actor: user.id, p_publicar: action === 'publicar_fluxo' }))
      return jsonResponse({ id })
    }
    if (action === 'ativar_fluxo') {
      const f = requireResult(await service.from('fluxos_evolution').select('id,whatsapp_versao_id,modo').eq('id', b.id).single())
      if (!f?.whatsapp_versao_id) return fail('publique_uma_versao_primeiro')
      requireResult(await service.from('fluxos_evolution').update({ ativo: b.ativo === true }).eq('id', f.id))
      await audit(user.id, 'whatsapp_fluxo_ativacao', 'fluxos_evolution', f.id)
      return jsonResponse({ ok: true })
    }
    if (action === 'salvar_template') {
      const t = requireResult(await service.from('templates_mensagem').select('*').eq('id', b.id).eq('canal', 'whatsapp').single())
      if (!t || t.codigo === 'wa_magic_link_v1') return fail('template_fora_do_lote')
      const text = String(b.text ?? ''); const keys = [...new Set([...text.matchAll(/\{\{([a-z_]+)\}\}/g)].map(m => m[1]))]
      if (!text.trim() || text.length > 1024 || /<[^>]*>/.test(text) || keys.some(k => !['nome', 'protocolo', 'status', 'nome_doc'].includes(k)) || /\{\{/.test(text.replace(/\{\{[a-z_]+\}\}/g, ''))) return fail('texto_ou_parametros_invalidos')
      const name = String(b.name ?? ''); if (!/^[a-z][a-z0-9_]{1,90}$/.test(name)) return fail('nome_meta_invalido')
      const cfg = await settings(); const cta = String(b.cta ?? '')
      if (cta.length > 25) return fail('botao_muito_longo')
      const components: Record<string, unknown>[] = [{ type: 'BODY', text: text.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => `{{${keys.indexOf(key) + 1}}}`), ...(keys.length ? { example: { body_text: [keys.map(k => ({ nome: 'Pessoa Exemplo', protocolo: 'MERC-2026-000001', status: 'Pré-análise', nome_doc: 'comprovante solicitado' }[k]))] } } : {}) }]
      if (cta) components.push({ type: 'BUTTONS', buttons: [{ type: 'URL', text: cta, url: 'https://www.mercuriocapitalsa.com.br/{{1}}', example: ['https://www.mercuriocapitalsa.com.br/p/login'] }] })
      const last = requireResult(await service.from('whatsapp_template_versoes').select('versao').eq('template_id', t.id).order('versao', { ascending: false }).limit(1))
      const saved = requireResult(await service.from('whatsapp_template_versoes').insert({ template_id: t.id, versao: (last?.[0]?.versao ?? 0) + 1, nome_meta: name, componentes: components, parametros: keys, conta_id: String(cfg.conta_id || ''), conteudo_hash: await hash(JSON.stringify(components)) }).select('id').single())
      if (!saved) throw new Error('persistencia_indisponivel')
      await audit(user.id, 'whatsapp_template_rascunho', 'whatsapp_template_versoes', saved.id)
      return jsonResponse({ id: saved.id })
    }
    if (['submeter_template', 'sincronizar_template', 'reconciliar_template', 'usar_template'].includes(action)) {
      const v = requireResult(await service.from('whatsapp_template_versoes').select('*').eq('id', b.id).single()); const cfg = await settings()
      if (!v) return fail('template_nao_encontrado')
      if (action === 'usar_template') {
        if (v.estado_meta !== 'APPROVED' || !v.sincronizado_em || Date.now() - Date.parse(v.sincronizado_em) > 900000) return fail('sincronize_template_aprovado_primeiro')
        requireResult(await service.from('whatsapp_template_versoes').update({ estado_local: 'publicado', publicado_por: user.id }).eq('id', v.id))
        requireResult(await service.from('templates_mensagem').update({ whatsapp_versao_id: v.id }).eq('id', v.template_id))
      } else {
        if (!/^\d+$/.test(String(cfg.conta_id))) return fail('configure_conta_meta')
        if (v.conta_id && v.conta_id !== cfg.conta_id) return fail('conta_divergente')
        if (action === 'submeter_template') {
          if (v.meta_template_id) return fail('ja_submetido_sincronize')
          // Reconcile by name before POST, including a previous uncertain submission.
          const found = await graphRequest(`${cfg.conta_id}/message_templates`, 'GET', undefined, { name: v.nome_meta, fields: 'id,name,language,status,category,components', limit: '100' })
          const prior = (found.data ?? []).find((t: { name: string; language: string }) => t.name === v.nome_meta && t.language === v.idioma)
          if (prior) return fail('nome_ja_existe_na_meta_reconciliar')
          const created = await graphRequest(`${cfg.conta_id}/message_templates`, 'POST', { name: v.nome_meta, language: v.idioma, category: v.categoria, components: v.componentes })
          requireResult(await service.from('whatsapp_template_versoes').update({ meta_template_id: created.id, conta_id: cfg.conta_id, estado_meta: created.status || 'PENDING', sincronizado_em: new Date().toISOString() }).eq('id', v.id))
        } else if (action === 'reconciliar_template') {
          if (v.meta_template_id) return fail('template_ja_vinculado_sincronize')
          const found = await graphRequest(`${cfg.conta_id}/message_templates`, 'GET', undefined, { name: v.nome_meta, fields: 'id,name,language,status,category,components', limit: '100' })
          const match = matchMetaTemplate(v, found.data)
          if (match.status === 'not_found') return fail('template_nao_encontrado_na_meta')
          if (match.status === 'ambiguous') return fail('mais_de_um_template_encontrado_na_meta')
          if (match.status === 'mismatch') return fail('conteudo_do_template_divergente_na_meta')
          const linked = requireResult(await service.from('whatsapp_template_versoes').update({ meta_template_id: match.template.id, conta_id: cfg.conta_id, estado_meta: match.template.status, motivo_meta: null, sincronizado_em: new Date().toISOString() }).eq('id', v.id).is('meta_template_id', null).select('id').single())
          if (!linked) return fail('template_ja_vinculado_sincronize', 409)
        } else {
          if (!v.meta_template_id) return fail('submeta_o_template_primeiro')
          const current = await graphRequest(v.meta_template_id, 'GET', undefined, { fields: 'id,name,language,status,category,components' })
          if (!approvedMetaTemplate(v, current)) { requireResult(await service.from('whatsapp_template_versoes').update({ estado_meta: 'DIVERGENTE', sincronizado_em: new Date().toISOString() }).eq('id', v.id)); return fail('template_divergente') }
          requireResult(await service.from('whatsapp_template_versoes').update({ estado_meta: current.status, motivo_meta: current.rejected_reason ? String(current.rejected_reason).slice(0, 300) : null, sincronizado_em: new Date().toISOString() }).eq('id', v.id))
        }
      }
      await audit(user.id, `whatsapp_${action}`, 'whatsapp_template_versoes', v.id)
      return jsonResponse({ ok: true })
    }
    if (['preview_flow_meta', 'rascunho_flow_meta', 'publicar_flow_meta', 'sincronizar_flow_meta'].includes(action)) {
      const v = requireResult(await service.from('whatsapp_fluxo_versoes').select('*').eq('id', b.id).single())
      if (!v) return fail('versao_nao_encontrada')
      let json: Record<string, unknown>
      try { json = compileNativeFlow({ nodes: v.nodes, edges: v.edges, viewport: v.viewport }) } catch (error) { return fail(error instanceof Error ? error.message : 'flow_incompativel') }
      if (action === 'preview_flow_meta') return jsonResponse({ flow_json: json })
      const cfg = await settings()
      if (action === 'rascunho_flow_meta') {
        if (!/^\d+$/.test(String(cfg.conta_id))) return fail('configure_conta_meta')
        let id = v.meta_flow_id
        if (!id) {
          const created = await graphRequest(`${cfg.conta_id}/flows`, 'POST', { name: `mercurio_triagem_${v.id.replace(/-/g, '')}`, categories: ['CUSTOMER_SUPPORT'] })
          id = created.id
          requireResult(await service.from('whatsapp_fluxo_versoes').update({ meta_flow_id: id, estado_meta: 'DRAFT' }).eq('id', v.id))
        }
        if (v.estado_meta === 'PUBLISHED') return fail('flow_publicado_imutavel')
        const form = new FormData(); form.append('name', 'flow.json'); form.append('asset_type', 'FLOW_JSON'); form.append('file', new Blob([JSON.stringify(json)], { type: 'application/json' }), 'flow.json')
        const uploaded = await graphRequest(`${id}/assets`, 'POST', form)
        requireResult(await service.from('whatsapp_fluxo_versoes').update({ flow_json: json, erros_meta: uploaded.validation_errors ?? [], sincronizado_em: new Date().toISOString() }).eq('id', v.id))
        return jsonResponse({ ok: uploaded.success === true, errors: uploaded.validation_errors ?? [] })
      }
      if (!v.meta_flow_id) return fail('crie_rascunho_meta_primeiro')
      if (action === 'publicar_flow_meta') {
        if (!v.flow_json || canonical(v.flow_json) !== canonical(json) || !Array.isArray(v.erros_meta) || v.erros_meta.length) return fail('valide_o_json_primeiro')
        await graphRequest(`${v.meta_flow_id}/publish`, 'POST')
      }
      const current = await graphRequest(v.meta_flow_id, 'GET', undefined, { fields: 'id,status,validation_errors' })
      requireResult(await service.from('whatsapp_fluxo_versoes').update({ estado_meta: current.status, erros_meta: current.validation_errors ?? [], sincronizado_em: new Date().toISOString() }).eq('id', v.id))
      await audit(user.id, `whatsapp_${action}`, 'whatsapp_fluxo_versoes', v.id)
      return jsonResponse({ ok: true })
    }
    if (action === 'configurar') {
      const cfg = await settings(); const next = { ...cfg }; delete next.ativo
      for (const k of ['envio_habilitado', 'automacoes_habilitadas', 'atendimento_habilitado']) next[k] = b[k] === true
      for (const k of ['conta_id', 'phone_number_id']) { if (b[k] && !/^\d{5,30}$/.test(String(b[k]))) return fail('id_meta_invalido'); next[k] = String(b[k] || '') }
      next.api_version = 'v26.0'; next.functions_base_url = `${Deno.env.get('SUPABASE_URL')}/functions/v1`; next.atendimento_fluxo_id = b.atendimento_fluxo_id || null
      if (next.atendimento_fluxo_id) {
        const selected = requireResult(await service.from('fluxos_evolution').select('whatsapp_versao_id,ativo').eq('id', next.atendimento_fluxo_id).eq('modo', 'atendimento').single())
        if (!selected?.whatsapp_versao_id || !selected.ativo) return fail('fluxo_atendimento_indisponivel')
      }
      if (next.envio_habilitado && (!Deno.env.get('WHATSAPP_ACCESS_TOKEN') || !next.phone_number_id || !Deno.env.get('WHATSAPP_WORKER_SECRET'))) return fail('credenciais_envio_ausentes')
      if (next.atendimento_habilitado && !next.atendimento_fluxo_id) return fail('selecione_fluxo_atendimento')
      const i = requireResult(await service.from('integracoes_config').update({ configuracoes: next }).eq('chave', 'whatsapp').select('id').single())
      if (!i) throw new Error('persistencia_indisponivel')
      await audit(user.id, 'whatsapp_configuracao', 'integracoes_config', i.id)
      return jsonResponse({ ok: true })
    }
    return fail('acao_invalida')
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    if (message === 'unauthorized' || message === 'forbidden') return fail(message, message === 'unauthorized' ? 401 : 403)
    // Domain validation is safe; upstream error bodies, tokens and payloads never leave the server.
    return fail(message.startsWith('meta_http_') || message === 'credenciais_envio_ausentes' ? message : 'operacao_indisponivel_verifique_dados', 400)
  }
})

import { workerIdentity, service, settings, requireResult, hash } from '../_shared/whatsapp-runtime.ts'
import { traceGraph, nextNode, type Graph, type FlowNode } from '../_shared/whatsapp-flow.ts'
import { templatePayload } from '../_shared/whatsapp-delivery.ts'
type Event = { id: string; reserva: string; evento: string; fluxo_versao_id: string; atendimento_id: string | null; mensagem_id: string | null; ocorrido_em: string; contexto: Record<string, string> }
const publicAnswers: Record<string, string> = {
 cliente: 'Você pode acompanhar suas propostas no portal seguro: https://www.mercuriocapitalsa.com.br/c/login . Se for parceiro, acesse https://www.mercuriocapitalsa.com.br/p/login . Para falar com a equipe, envie HUMANO.',
 credito: 'A Mercúrio Capital trabalha com Home Equity, Crédito para Construção e Financiamento Imobiliário. As condições dependem da análise de cada operação. Conheça o simulador: https://www.mercuriocapitalsa.com.br/simulador . Para falar com a equipe, envie HUMANO.',
 parceiro: 'No workspace Mercúrio você pode originar propostas e acompanhar suas operações. Conheça o cadastro de parceiro: https://www.mercuriocapitalsa.com.br/p/registro . O cadastro passa por aprovação. Para falar com a equipe, envie HUMANO.',
}
async function process(e: Event, cfg: Record<string, unknown>) {
  const v = requireResult(await service.from('whatsapp_fluxo_versoes').select('*,fluxos_evolution!fluxo_id(modo,ativo)').eq('id', e.fluxo_versao_id).single())
  const graph: Graph = { nodes: v.nodes, edges: v.edges, viewport: v.viewport }
  const mode = v.fluxos_evolution.modo
  const outputs: Record<string, unknown>[] = []; let checkpoint: Record<string, unknown> | null = null
  const visited: { id: string; motivo?: string }[] = []
  if (!v.fluxos_evolution.ativo || (mode === 'notificacao' ? cfg.automacoes_habilitadas !== true : cfg.atendimento_habilitado !== true)) {
    visited.push({ id: 'entry', motivo: 'fluxo_pausado' })
  } else if (mode === 'notificacao') {
    let roles: string[] = ['titular']
    for (const n of traceGraph(graph, mode, e.contexto)) {
      visited.push({ id: n.id })
      if (n.data.kind === 'recipients') roles = n.data.roles as string[]
      if (n.data.kind !== 'template') continue
      const t = requireResult(await service.from('templates_mensagem').select('whatsapp_versao_id,ativo').eq('codigo', n.data.template).eq('canal', 'whatsapp').single())
      if (!t?.ativo || !t.whatsapp_versao_id) { visited.push({ id: n.id, motivo: 'template_nao_publicado' }); continue }
      const recipients = requireResult(await service.rpc('whatsapp_evento_destinatarios', { p_id: e.id, p_roles: roles }))
      if (!recipients?.length) visited.push({ id: n.id, motivo: 'sem_destinatario_autorizado' })
      const seen = new Set<string>()
      for (const recipient of recipients ?? []) {
        if (seen.has(recipient.telefone)) continue; seen.add(recipient.telefone)
        const payload = await templatePayload(t.whatsapp_versao_id, recipient.variaveis)
        outputs.push({ node: n.id, usuario_id: recipient.usuario_id, destinatario_papel: recipient.papel, telefone: recipient.telefone, corpo: payload.corpo, payload: payload.payload, template_versao_id: t.whatsapp_versao_id })
      }
    }
  } else {
    const a = requireResult(await service.from('whatsapp_atendimentos').select('*').eq('id', e.atendimento_id).single())
    const message = requireResult(await service.from('whatsapp_mensagens_recebidas').select('*').eq('id', e.mensagem_id).single())
    const text = String(message.text_body || message.interacao?.option_id || '').trim().toLocaleLowerCase('pt-BR')
    const enqueue = (node: string, body: string, payload?: Record<string, unknown>) => outputs.push({ node, telefone: a.sender_phone, corpo: body, payload: payload ?? { type: 'text', text: { body, preview_url: false } } })
    if (a.estado !== 'bot' || Date.now() - Date.parse(message.received_at) >= 86400000 || Date.parse(message.received_at) < Date.parse(a.ultima_mensagem_em) - 300000) {
      visited.push({ id: 'entry', motivo: 'sessao_humana_encerrada_ou_evento_antigo' })
    } else if (message.interacao?.flow_token_hash && (!a.flow_token_hash || message.interacao.flow_token_hash !== a.flow_token_hash || Date.parse(a.flow_token_expira_em) <= Date.now())) {
      visited.push({ id: 'entry', motivo: 'interacao_invalida_ou_repetida' })
    } else if (['humano', 'atendente', 'falar com a equipe', '4'].includes(text)) {
      enqueue('human', 'Seu atendimento foi encaminhado à equipe da Mercúrio Capital. A resposta depende da disponibilidade dos atendentes.'); checkpoint = { estado: 'fila_humana', node: a.no_atual_id }; visited.push({ id: 'human' })
    } else {
      let start: string | undefined; let continueGraph = true
      const current = graph.nodes.find(n => n.id === a.no_atual_id)
      if (current?.data.kind === 'form') {
        const answer = message.interacao
        if (!answer || !a.flow_token_hash || answer.flow_token_hash !== a.flow_token_hash || Date.parse(a.flow_token_expira_em) <= Date.now() || !['cliente', 'credito', 'parceiro', 'humano'].includes(answer.assunto)) {
          enqueue('fallback', 'Para continuar, conclua o formulário de atendimento enviado acima ou escreva HUMANO para falar com a equipe.'); continueGraph = false
        } else {
          const body = publicAnswers[answer.assunto] ?? 'Seu atendimento foi encaminhado à equipe da Mercúrio Capital.'
          enqueue(current.id, body)
          checkpoint = { estado: answer.assunto === 'humano' ? 'fila_humana' : 'bot', node: null }
          continueGraph = false
          visited.push({ id: current.id })
        }
      } else if (current?.data.kind === 'menu') {
        const options = current.data.options as { id: string; title: string }[]
        const selected = options.find((o, i) => o.id === text || o.title.toLocaleLowerCase('pt-BR') === text || String(i + 1) === text)
        if (selected) start = nextNode(graph, current.id, selected.id)
        else { enqueue('fallback', 'Não reconheci essa opção. Escolha uma das opções acima ou envie HUMANO.'); continueGraph = false }
      }
      if (continueGraph) {
        const route = traceGraph(graph, mode, { evento: e.evento }, start)
        for (const n of route) {
          visited.push({ id: n.id }); checkpoint = { node: n.id, estado: 'bot' }
          if (n.data.kind === 'reply') enqueue(n.id, String(n.data.text))
          if (n.data.kind === 'menu') {
            const options = n.data.options as { id: string; title: string }[]
            enqueue(n.id, `${n.data.text}\n${options.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}\nEnvie HUMANO para falar com a equipe.`)
          }
          if (n.data.kind === 'form') {
            if (v.estado_meta !== 'PUBLISHED' || !v.meta_flow_id) {
              enqueue(n.id, 'Olá! Sou a MERX, assistente virtual da Mercúrio Capital. Envie CLIENTE para acessar seu painel, CRÉDITO para conhecer nossos serviços, PARCEIRO para conhecer o cadastro ou HUMANO para falar com a equipe.'); checkpoint = { node: null, estado: 'bot', contexto: { menu_publico: true } }
            } else {
              const token = crypto.randomUUID()
              checkpoint = { node: n.id, estado: 'bot', flow_token_hash: await hash(token), flow_token_expira_em: new Date(Date.now() + 3600000).toISOString() }
              const screen = (v.flow_json?.screens?.[0]?.id) as string | undefined
              if (!screen) throw new Error('formulario_nao_validado')
              enqueue(n.id, String(n.data.text), { type: 'interactive', interactive: { type: 'flow', body: { text: String(n.data.text) }, action: { name: 'flow', parameters: { flow_message_version: '3', flow_token: token, flow_id: v.meta_flow_id, flow_cta: 'Iniciar atendimento', flow_action: 'navigate', flow_action_payload: { screen } } } } })
            }
          }
          if (n.data.kind === 'handoff') { enqueue(n.id, 'Seu atendimento foi encaminhado à equipe da Mercúrio Capital.'); checkpoint.estado = 'fila_humana' }
          if (n.data.kind === 'end') checkpoint = { node: null, estado: 'bot' }
        }
      }
      // Text fallback uses only the approved public triage, not proposal/customer data.
      if (a.contexto?.menu_publico && !a.no_atual_id) {
        const key = ['cliente', 'credito', 'crédito', 'parceiro'].includes(text) ? (text === 'crédito' ? 'credito' : text) : ''
        if (key) { outputs.length = 0; enqueue('public', publicAnswers[key]); checkpoint = { node: null, estado: 'bot', contexto: { menu_publico: true } } }
      }
    }
  }
  requireResult(await service.rpc('whatsapp_evento_concluir', { p_id: e.id, p_reserva: e.reserva, p_saidas: outputs, p_caminho: visited, p_atendimento: checkpoint }))
}
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  if (!await workerIdentity(req)) return new Response('unauthorized', { status: 401 })
  try {
    const cfg = await settings()
    if (!cfg.ativo || (cfg.automacoes_habilitadas !== true && cfg.atendimento_habilitado !== true)) return Response.json({ paused: true })
    const events = requireResult(await service.rpc('whatsapp_eventos_pull', { p_limit: 10 })) as Event[]
    let completed = 0
    for (const e of events) {
      try { await process(e, cfg); completed++ }
      catch { requireResult(await service.from('whatsapp_eventos').update({ status: 'erro', motivo: 'processamento_indisponivel_sem_reenvio' }).eq('id', e.id).eq('reserva', e.reserva)) }
    }
    return Response.json({ picked: events.length, completed })
  } catch { return Response.json({ error: 'worker_indisponivel' }, { status: 503 }) }
})

import { service, settings } from './whatsapp-runtime.ts'
export type Outbound = { id?: string; telefone: string; corpo: string; atendimento_id?: string | null; usuario_id?: string | null; template_versao_id?: string | null; whatsapp_evento_id?: string | null; destinatario_papel?: string | null; payload_envio?: Record<string, unknown> | null; created_at?: string; origem?: string; solicitado_por?: string | null }
export async function deliveryAllowed(row: Outbound, cfg: Record<string, unknown>): Promise<string | null> {
  if (!cfg.ativo || cfg.envio_habilitado !== true) return 'envio_desativado'
  const phone = row.telefone.replace(/\D/g, '')
  if (!/^\d{8,15}$/.test(phone)) return 'telefone_invalido'
  const businessPhone = String(cfg.phone_number_id || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '')
  const consent = await service.from('whatsapp_consentimentos').select('estado,usuario_id,finalidade').eq('phone_number_id', businessPhone).eq('telefone', `+${phone}`)
  if (consent.error) return 'consentimento_indisponivel'
  if (consent.data?.some(c => c.estado === 'revogado')) return 'optout'
  if (row.usuario_id) {
    const { data: partners, error } = await service.from('partners').select('id').eq('usuario_id', row.usuario_id)
    if (error) return 'preferencia_indisponivel'
    if (partners?.length) {
      const pref = await service.from('partner_notif_prefs').select('whatsapp').in('partner_id', partners.map(p => p.id))
      if (pref.error || pref.data?.some(p => p.whatsapp === false)) return 'preferencia_bloqueada'
    }
  }
  if (row.template_versao_id) {
    if (!row.usuario_id || !consent.data?.some(c => c.finalidade === 'notificacoes' && c.estado === 'autorizado' && c.usuario_id === row.usuario_id)) return 'optin_ausente'
    const { data: profile, error: profileError } = await service.from('usuarios').select('telefone_ddi,telefone,ativo').eq('id', row.usuario_id).single()
    if (profileError || !profile?.ativo || `${profile.telefone_ddi ?? '55'}${profile.telefone ?? ''}`.replace(/\D/g, '') !== phone) return 'identidade_nao_verificada'
    const version = await service.from('whatsapp_template_versoes').select('*,templates_mensagem!template_id(ativo,whatsapp_versao_id)').eq('id', row.template_versao_id).single()
    const v = version.data
    if (version.error || !v || v.estado_meta !== 'APPROVED' || v.estado_local !== 'publicado' || !v.templates_mensagem?.ativo || v.templates_mensagem.whatsapp_versao_id !== v.id || v.conta_id !== cfg.conta_id) return 'template_indisponivel'
    if (!v.sincronizado_em || Date.now() - Date.parse(v.sincronizado_em) > 15 * 60 * 1000) return 'template_exige_sincronizacao'
    const payload = row.payload_envio as { template?: { name?: string; language?: { code?: string } } } | undefined
    if (payload?.template?.name !== v.nome_meta || payload?.template?.language?.code !== v.idioma) return 'versao_divergente'
  } else {
    if (!row.atendimento_id) return 'atendimento_obrigatorio'
    const { data: a, error } = await service.from('whatsapp_atendimentos').select('sender_phone,phone_number_id,ultima_mensagem_em,estado,expira_em,responsavel_id').eq('id', row.atendimento_id).single()
    if (error || !a || a.sender_phone !== `+${phone}` || a.phone_number_id !== businessPhone || ['optout', 'encerrado'].includes(a.estado) || Date.parse(a.expira_em) <= Date.now()) return 'atendimento_invalido'
    if (row.origem === 'fluxo' && a.estado === 'humano') return 'bot_pausado_por_operador'
    if (row.solicitado_por) {
      const operator = await service.from('usuarios').select('ativo,role').eq('id', row.solicitado_por).single()
      if (operator.error || !operator.data?.ativo || operator.data.role !== 'admin' || a.responsavel_id !== row.solicitado_por || a.estado !== 'humano') return 'operador_sem_atendimento'
    }
    const age = Date.now() - Date.parse(a.ultima_mensagem_em)
    if (!Number.isFinite(age) || age < 0 || age >= 86400000) return 'janela_24h_encerrada'
  }
  return null
}
export async function templatePayload(versionId: string, vars: Record<string, string>) {
  const { data: v, error } = await service.from('whatsapp_template_versoes').select('*').eq('id', versionId).single()
  if (error || !v || v.estado_meta !== 'APPROVED' || v.estado_local !== 'publicado') throw new Error('template_indisponivel')
  const params = (v.parametros as string[]).map(k => { const value = vars[k]; if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new Error(`parametro_ausente_${k}`); return value })
  const body = (v.componentes as { type: string; text?: string }[]).find(c => c.type === 'BODY')?.text ?? ''
  const corpo = body.replace(/\{\{(\d+)\}\}/g, (_, number) => params[Number(number) - 1] ?? '')
  const components: Record<string, unknown>[] = params.length ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] : []
  if ((v.componentes as { type: string }[]).some(c => c.type === 'BUTTONS')) {
    const url = new URL(vars.link || '')
    if (url.origin !== 'https://www.mercuriocapitalsa.com.br' || !/^\/(?:p|c|admin)\/(?:login|propostas\/[0-9a-f-]{36})$/.test(url.pathname) || url.search || url.hash) throw new Error('link_invalido')
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: url.pathname.slice(1) }] })
  }
  return { corpo, payload: { type: 'template', template: { name: v.nome_meta, language: { code: v.idioma }, components } } }
}

export const PROSPECCAO_CLIENTE_STATUS = [
  'novo',
  'em_contato',
  'qualificado',
  'proposta_criada',
  'perdido',
] as const

export type ProspeccaoClienteStatus = (typeof PROSPECCAO_CLIENTE_STATUS)[number]

export const PROSPECCAO_CLIENTE_STATUS_LABEL: Record<ProspeccaoClienteStatus, string> = {
  novo: 'Novos',
  em_contato: 'Em contato',
  qualificado: 'Qualificados',
  proposta_criada: 'Proposta criada',
  perdido: 'Perdidos',
}

export const PROSPECCAO_CLIENTE_ORIGENS = ['indicacao', 'whatsapp', 'evento', 'site', 'outro'] as const
export type ProspeccaoClienteOrigem = (typeof PROSPECCAO_CLIENTE_ORIGENS)[number]

export const PROSPECCAO_CLIENTE_ORIGEM_LABEL: Record<ProspeccaoClienteOrigem, string> = {
  indicacao: 'Indicação',
  whatsapp: 'WhatsApp',
  evento: 'Evento',
  site: 'Site',
  outro: 'Outro',
}

export type ProspeccaoCliente = {
  id: string
  partner_id: string
  equipe_id: string | null
  responsavel_id: string
  nome_completo: string
  email: string | null
  telefone: string | null
  origem: ProspeccaoClienteOrigem | null
  notas: string | null
  status: ProspeccaoClienteStatus
  motivo_perda: string | null
  proposta_id: string | null
  convertido_em: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export function mapearErroProspeccaoCliente(code?: string, message?: string): string {
  const msg = message ?? ''
  if (code === '40001' || msg.includes('prospeccao_cliente_status_conflito')) {
    return 'Outro usuário atualizou este prospect. O funil foi atualizado.'
  }
  if (code === 'P0002' || msg.includes('prospeccao_cliente_nao_encontrada')) return 'Este prospect não está mais disponível.'
  if (msg.includes('contato_obrigatorio')) return 'Informe ao menos um canal de contato: e-mail ou telefone.'
  if (msg.includes('motivo_perda_obrigatorio')) return 'Informe o motivo da perda (mínimo 3 caracteres).'
  if (msg.includes('prospeccao_cliente_ja_convertida')) return 'Este prospect já foi convertido em proposta.'
  if (msg.includes('prospeccao_cliente_fora_da_etapa_de_conversao')) return 'Avance o prospect para “Qualificado” antes de criar a proposta.'
  if (msg.includes('equipe_fora_do_parceiro')) return 'A equipe selecionada não pertence ao parceiro responsável.'
  if (msg.includes('equipe_nao_alteravel')) return 'Membros de equipe não podem reatribuir o prospect para outra equipe.'
  if (msg.includes('parceiro_indisponivel')) return 'O parceiro selecionado não está disponível para receber prospects.'
  if (msg.includes('2fa_required')) return 'Conclua a verificação 2FA para operar a carteira de prospecção.'
  if (code === '42501' || msg.includes('forbidden')) return 'Seu perfil não tem permissão para esta ação.'
  return 'Não foi possível concluir. Tente novamente.'
}

export function prospeccaoClienteTelefoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13)
}

export function prospeccaoClienteTelefoneDisplay(value: string): string {
  let digits = prospeccaoClienteTelefoneDigits(value)
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

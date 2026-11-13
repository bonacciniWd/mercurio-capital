// Funil de prospecção de parceiros (issue #34) — constantes e mapeamento de erros.
// 8 colunas na ordem fixa aprovada pelo dono.

export const PROSPECCAO_STATUS = [
  'oportunidade',
  'follow_up',
  'reuniao_realizada',
  'reuniao_continuacao_a_marcar',
  'reuniao_continuacao_realizada',
  'fechamento_documental',
  'nca_mandato',
  'converter_proposta',
] as const

export type ProspeccaoStatus = (typeof PROSPECCAO_STATUS)[number]

export const PROSPECCAO_STATUS_LABEL: Record<ProspeccaoStatus, string> = {
  oportunidade: 'Oportunidades',
  follow_up: 'Follow Up',
  reuniao_realizada: 'Reunião Realizada',
  reuniao_continuacao_a_marcar: 'Reunião de continuação: a marcar',
  reuniao_continuacao_realizada: 'Reunião de continuação: Realizada',
  fechamento_documental: 'Fechamento e avanço documental',
  nca_mandato: 'NCA/Mandato',
  converter_proposta: 'Converter em proposta',
}

export const PROSPECCAO_ORIGEM = ['indicacao', 'evento', 'outbound', 'site', 'outro'] as const
export type ProspeccaoOrigem = (typeof PROSPECCAO_ORIGEM)[number]

export const PROSPECCAO_ORIGEM_LABEL: Record<ProspeccaoOrigem, string> = {
  indicacao: 'Indicação',
  evento: 'Evento',
  outbound: 'Prospecção ativa',
  site: 'Site',
  outro: 'Outro',
}

// PostgREST devolve SQLSTATE em error.code e a mensagem em error.message.
// Mapear por code + substring (mesmo cuidado de propostaObservacaoAnexo).
export function mapearErroProspeccao(code?: string, message?: string): string {
  const msg = message ?? ''
  if (code === '40001' || msg.includes('status_conflito')) {
    return 'Outro membro da equipe moveu este card. O funil foi atualizado.'
  }
  if (code === '42501' || msg.includes('forbidden')) {
    return 'Seu perfil não tem permissão para esta ação.'
  }
  if (code === 'P0002' || msg.includes('prospeccao_nao_encontrada')) {
    return 'Esta oportunidade foi arquivada ou removida. O funil foi atualizado.'
  }
  if (msg.includes('contato_obrigatorio')) return 'Informe ao menos um canal de contato: e-mail ou telefone.'
  if (msg.includes('motivo_obrigatorio')) return 'Informe o motivo do arquivamento (mínimo 3 caracteres).'
  if (msg.includes('ja_arquivada')) return 'Esta oportunidade já está arquivada.'
  if (msg.includes('maximo_3_anexos')) return 'Máximo de 3 prints por oportunidade.'
  if (msg.includes('prospeccao_ja_convertida')) return 'Esta oportunidade já foi convertida em proposta.'
  if (msg.includes('prospeccao_nao_esta_na_etapa_de_conversao')) return 'Mova o card para "Converter em proposta" antes de converter.'
  if (msg.includes('extensao_incoerente')) return 'O tipo do arquivo não corresponde à extensão.'
  if (msg.includes('mime_invalido')) return 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.'
  if (msg.includes('tamanho_invalido')) return 'O print deve ter no máximo 2 MB.'
  return 'Não foi possível concluir. Tente novamente.'
}

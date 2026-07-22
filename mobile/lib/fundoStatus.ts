export const FUNDO_STATUS = ['aprovado', 'atencao', 'aguardando', 'rejeitado'] as const

export type FundoStatus = typeof FUNDO_STATUS[number]

export const FUNDO_STATUS_LABEL: Record<FundoStatus, string> = {
  aprovado: 'Aprovado',
  atencao: 'Atenção',
  aguardando: 'Aguardando',
  rejeitado: 'Rejeitado',
}

// verde=aprovado, laranja=atencao, amarelo=aguardando, vermelho=rejeitado
export const FUNDO_STATUS_COLOR: Record<FundoStatus, string> = {
  aprovado: '#16a34a',
  atencao: '#f97316',
  aguardando: '#eab308',
  rejeitado: '#dc2626',
}

export const FUNDO_COR_PADRAO = '#2563eb'

export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatNumber = (n: number) => n.toLocaleString('pt-BR')

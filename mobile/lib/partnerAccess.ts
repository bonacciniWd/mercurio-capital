export type PartnerRole = 'partner' | 'team_member' | 'client' | 'admin' | null | undefined
export type PartnerSection = 'empresa' | 'notificacoes' | 'integracoes' | 'seguranca'

export function canManagePartner(role: PartnerRole): boolean { return role === 'partner' }

export function partnerSection(value: string | string[] | undefined, role: PartnerRole): PartnerSection {
  if (!canManagePartner(role)) return 'seguranca'
  const section = Array.isArray(value) ? value[0] : value
  return section === 'notificacoes' || section === 'integracoes' || section === 'seguranca' ? section : 'empresa'
}

export function isPartnerPrimaryRoute(segments: readonly string[]): boolean {
  return segments.length === 2 && segments[0] === '(parceiro)'
    && ['dashboard', 'propostas', 'promocoes', 'carteira', 'perfil'].includes(segments[1])
}

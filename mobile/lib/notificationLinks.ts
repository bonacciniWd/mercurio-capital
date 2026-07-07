type MobileRole = 'admin' | 'partner' | 'team_member' | 'client' | null | undefined

function fallbackByRole(role: MobileRole): string {
  if (role === 'admin') return '/(admin)'
  if (role === 'partner' || role === 'team_member') return '/(parceiro)/dashboard'
  if (role === 'client') return '/(cliente)'
  return '/login'
}

function normalizeLink(link: string | null | undefined): string | null {
  if (!link) return null

  const trimmed = link.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      return `${url.pathname}${url.search}${url.hash}`
    } catch {
      return null
    }
  }

  if (!trimmed.startsWith('/')) return null

  return trimmed
}

function toSegments(path: string): string[] {
  const noQuery = path.split('?')[0]?.split('#')[0] ?? ''
  return noQuery.split('/').filter(Boolean)
}

function mapAdmin(segments: string[]): string {
  if (segments.length <= 1) return '/(admin)'

  const section = segments[1]
  const id = segments[2]

  if (section === 'dashboard') return '/(admin)/dashboard'
  if (section === 'kanban') return '/(admin)/kanban'
  if (section === 'aprovacoes') return '/(admin)/aprovacoes'
  if (section === 'parceiros') return '/(admin)/parceiros'
  if (section === 'propostas') return id ? `/(admin)/proposta/${id}` : '/(admin)/propostas'
  if (section === 'rede') return '/(admin)/rede'
  if (section === 'campanhas') return '/(admin)/campanhas'
  if (section === 'fluxos') return '/(admin)/fluxos'
  if (section === 'templates') return '/(admin)/templates'
  if (section === 'integracoes') return '/(admin)/integracoes'
  if (section === 'universidade') return '/(admin)/universidade'
  if (section === 'auditoria') return '/(admin)/auditoria'
  if (section === 'relatorios') return '/(admin)/relatorios'
  if (section === 'feature-flags') return '/(admin)/feature-flags'
  if (section === 'configuracoes') return '/(admin)/configuracoes'

  if (section === 'financeiro') {
    if (id === 'carteiras') return '/(admin)/carteiras'
    if (id === 'precos') return '/(admin)/precos'
    return '/(admin)/financeiro'
  }

  return '/(admin)'
}

function mapPartner(segments: string[]): string {
  if (segments.length <= 1) return '/(parceiro)/dashboard'

  const section = segments[1]
  const id = segments[2]

  if (section === 'dashboard') return '/(parceiro)/dashboard'
  if (section === 'simulacoes') return '/(parceiro)/simulacoes'
  if (section === 'propostas') return id ? `/(parceiro)/propostas/${id}` : '/(parceiro)/propostas'
  if (section === 'carteira') return '/(parceiro)/carteira'
  if (section === 'comissoes') return '/(parceiro)/comissoes'
  if (section === 'relatorios') return '/(parceiro)/relatorios'
  if (section === 'universidade') return '/(parceiro)/universidade'
  if (section === 'equipe') return '/(parceiro)/equipe'
  if (section === 'configuracoes') return '/(parceiro)/configuracoes'
  if (section === 'perfil') return '/(parceiro)/perfil'
  if (section === 'promocoes') return '/(parceiro)/promocoes'
  if (section === 'contrato') return '/(parceiro)/contrato'
  if (section === 'aula') return id ? `/(parceiro)/aula/${id}` : '/(parceiro)/universidade'

  return '/(parceiro)/dashboard'
}

function mapClient(segments: string[]): string {
  if (segments.length <= 1) return '/(cliente)'

  const section = segments[1]
  const id = segments[2]

  if (section === 'documentos') return '/(cliente)/documentos'
  if (section === 'universidade') return '/(cliente)/universidade'
  if (section === 'propostas') return id ? `/(cliente)/propostas/${id}` : '/(cliente)'

  return '/(cliente)'
}

export function resolveNotificationLinkToRoute(
  link: string | null | undefined,
  role: MobileRole,
): string {
  const fallback = fallbackByRole(role)
  const normalized = normalizeLink(link)

  if (!normalized) return fallback

  if (normalized.startsWith('/(admin)') || normalized.startsWith('/(parceiro)') || normalized.startsWith('/(cliente)')) {
    return normalized
  }

  const segments = toSegments(normalized)
  if (segments.length === 0) return fallback

  if (segments[0] === 'admin') return mapAdmin(segments)
  if (segments[0] === 'p') return mapPartner(segments)
  if (segments[0] === 'c') return mapClient(segments)

  return fallback
}

import type { AuthSession } from '@/auth/types'

// Itens de menu (paths absolutos) visíveis para o admin limitado.
// Detalhe de proposta não tem item de menu próprio (é acessado via Kanban/Parceiros).
export const LIMITED_ADMIN_NAV_ALLOWLIST = new Set<string>([
  '/admin',
  '/admin/aprovacoes',
  '/admin/parceiros',
  '/admin/rede',
  '/admin/kanban',
])

export function isLimitedAdmin(session: AuthSession | null | undefined): boolean {
  return session?.role === 'admin' && session.adminNivel === 'limitado'
}

export function isLimitedAdminNavPath(to: string): boolean {
  return LIMITED_ADMIN_NAV_ALLOWLIST.has(to)
}

// Verifica se a rota (pathname absoluto) é permitida para o admin limitado.
// Permitido: dashboard (index), aprovacoes, parceiros, parceiros/:id/equipes,
// rede, kanban e propostas/:id (detalhe — exceto "nova").
export function isLimitedAdminPathAllowed(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '')

  if (normalized === '/admin' || normalized === '') {
    return true
  }

  if (!normalized.startsWith('/admin/')) {
    // Fora do módulo admin: não é responsabilidade deste guard bloquear.
    return true
  }

  const segments = normalized.slice('/admin/'.length).split('/').filter(Boolean)

  if (segments.length === 1) {
    return segments[0] === 'aprovacoes' || segments[0] === 'parceiros'
      || segments[0] === 'rede' || segments[0] === 'kanban'
  }

  if (segments.length === 2 && segments[0] === 'propostas') {
    return segments[1] !== 'nova'
  }

  if (segments.length === 3 && segments[0] === 'parceiros' && segments[2] === 'equipes') {
    return true
  }

  return false
}

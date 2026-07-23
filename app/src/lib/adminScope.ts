import type { AdminNivel, AuthSession } from '@/auth/types'

// Escopo de admin por `admin_nivel`:
// - full:     acesso total (o guard nem chega a restringir).
// - limitado: base + Propostas (listagem/detalhe), Nova proposta (criação) e Relatórios.
// - juridico: base + Propostas (listagem/detalhe) e Relatórios — SEM criação de proposta.
//
// "base" = dashboard, aprovações, parceiros (+ equipes), rede e kanban.

// Itens de menu (paths absolutos) visíveis para admins de escopo reduzido.
// limitado e juridico compartilham o mesmo menu (a diferença de criação é
// aplicada por rota e pelo botão "Nova proposta", não por item de menu).
const RESTRICTED_ADMIN_NAV_ALLOWLIST = new Set<string>([
  '/admin',
  '/admin/aprovacoes',
  '/admin/parceiros',
  '/admin/rede',
  '/admin/kanban',
  '/admin/propostas',
  '/admin/relatorios',
])

// Retorna o admin_nivel efetivo da sessão, ou null se não for admin.
export function adminNivelOf(session: AuthSession | null | undefined): AdminNivel | null {
  if (session?.role !== 'admin') {
    return null
  }
  return session.adminNivel ?? 'full'
}

export function isRestrictedAdmin(session: AuthSession | null | undefined): boolean {
  const nivel = adminNivelOf(session)
  return nivel === 'limitado' || nivel === 'juridico'
}

export function isRestrictedAdminNavPath(to: string): boolean {
  return RESTRICTED_ADMIN_NAV_ALLOWLIST.has(to)
}

// Somente full e limitado podem criar proposta (rota admin e botão "Nova proposta").
export function canCreateProposta(session: AuthSession | null | undefined): boolean {
  const nivel = adminNivelOf(session)
  return nivel === 'full' || nivel === 'limitado'
}

// Verifica se a rota (pathname absoluto) é permitida para o admin_nivel informado.
export function isAdminPathAllowed(pathname: string, nivel: AdminNivel): boolean {
  if (nivel === 'full') {
    return true
  }

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
    const seg = segments[0]
    // Comum a limitado e juridico (leitura).
    return seg === 'aprovacoes' || seg === 'parceiros' || seg === 'rede'
      || seg === 'kanban' || seg === 'propostas' || seg === 'relatorios'
  }

  if (segments.length === 2 && segments[0] === 'propostas') {
    if (segments[1] === 'nova') {
      // Criação de proposta: apenas limitado (full já retornou true acima).
      return nivel === 'limitado'
    }
    // Detalhe de proposta (`propostas/:id`): limitado e juridico.
    return true
  }

  if (segments.length === 3 && segments[0] === 'parceiros' && segments[2] === 'equipes') {
    return true
  }

  return false
}

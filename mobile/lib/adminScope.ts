// Escopo de admin por `admin_nivel` — paridade com o web (`app/src/lib/adminScope.ts`).
// - full:     acesso total.
// - limitado: base + Propostas, Nova proposta (criação) e Relatórios.
// - juridico: base + Propostas e Relatórios — SEM criação de proposta.

type AdminNivel = 'full' | 'limitado' | 'juridico'

type SessionLike = {
  role: 'admin' | 'partner' | 'team_member' | 'client' | null
  adminNivel: AdminNivel
} | null | undefined

// hrefs do hub admin mobile liberados para escopo reduzido (espelha a nav web).
const RESTRICTED_ADMIN_HREFS = new Set<string>([
  '/(admin)/dashboard',
  '/(admin)/kanban',
  '/(admin)/aprovacoes',
  '/(admin)/parceiros',
  '/(admin)/propostas',
  '/(admin)/rede',
  '/(admin)/relatorios',
])

export function adminNivelOf(session: SessionLike): AdminNivel | null {
  if (!session || session.role !== 'admin') {
    return null
  }
  return session.adminNivel ?? 'full'
}

export function isRestrictedAdmin(session: SessionLike): boolean {
  const nivel = adminNivelOf(session)
  return nivel === 'limitado' || nivel === 'juridico'
}

// Somente full e limitado podem criar proposta.
export function canCreateProposta(session: SessionLike): boolean {
  const nivel = adminNivelOf(session)
  return nivel === 'full' || nivel === 'limitado'
}

export function restrictedAdminAllowsHref(href: string): boolean {
  return RESTRICTED_ADMIN_HREFS.has(href)
}

import type { AdminNivel, AuthSession } from '@/auth/types'

// Escopo de admin por `admin_nivel`:
// - full:     acesso total (o guard nem chega a restringir).
// - limitado: base + Propostas (listagem/detalhe), Nova proposta (criação) e Relatórios.
// - juridico: base + Propostas (listagem/detalhe) e Relatórios — SEM criação de proposta.
// - comercial: base comercial (aprovações, parceiros, rede, propostas, leads, carteiras,
//   universidade) + Prospecção (/admin/prospeccao) — SEM financeiro geral, configurações,
//   feature flags, integrações, usuários internos, relatórios, kanban de propostas.
//
// "base" (limitado/juridico) = dashboard, aprovações, parceiros (+ equipes), rede e kanban.

// Itens de menu (paths absolutos) visíveis para admins de escopo reduzido.
// juridico usa a allowlist base; limitado ganha Prospecção (S4 — issue #34).
// (A diferença de criação de proposta segue aplicada por rota e pelo botão
// "Nova proposta", não por item de menu.)
const RESTRICTED_ADMIN_NAV_ALLOWLIST = new Set<string>([
  '/admin',
  '/admin/aprovacoes',
  '/admin/parceiros',
  '/admin/rede',
  '/admin/kanban',
  '/admin/propostas',
  '/admin/leads/simulacoes',
  '/admin/relatorios',
  '/admin/integracoes/whatsapp',
])

// Menu do nível limitado: base + Prospecção (/admin/prospeccao). juridico NÃO (S4).
const LIMITADO_ADMIN_NAV_ALLOWLIST = new Set<string>([
  ...RESTRICTED_ADMIN_NAV_ALLOWLIST,
  '/admin/prospeccao',
])

// Menu do nível comercial (separado: tem carteiras/universidade/prospecção; não tem
// kanban/relatórios/whatsapp de propostas).
const COMERCIAL_ADMIN_NAV_ALLOWLIST = new Set<string>([
  '/admin',
  '/admin/aprovacoes',
  '/admin/parceiros',
  '/admin/rede',
  '/admin/propostas',
  '/admin/leads/simulacoes',
  '/admin/financeiro/carteiras',
  '/admin/universidade',
  '/admin/prospeccao',
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
  return nivel === 'limitado' || nivel === 'juridico' || nivel === 'comercial'
}

export function isRestrictedAdminNavPath(to: string, nivel?: AdminNivel | null): boolean {
  if (nivel === 'comercial') {
    return COMERCIAL_ADMIN_NAV_ALLOWLIST.has(to)
  }
  if (nivel === 'limitado') {
    return LIMITADO_ADMIN_NAV_ALLOWLIST.has(to)
  }
  // juridico (e chamadas sem nível) — allowlist base, sem prospecção (S4).
  return RESTRICTED_ADMIN_NAV_ALLOWLIST.has(to)
}

// Somente full, limitado e comercial podem criar proposta (rota admin e botão "Nova proposta";
// comercial precisa criar a partir da conversão do funil de prospecção — decisão S1 do dono).
export function canCreateProposta(session: AuthSession | null | undefined): boolean {
  const nivel = adminNivelOf(session)
  return nivel === 'full' || nivel === 'limitado' || nivel === 'comercial'
}

// Verifica se a rota (pathname absoluto) é permitida para o admin_nivel informado.
export function isAdminPathAllowed(pathname: string, nivel: AdminNivel): boolean {
  if (nivel === 'full') {
    return true
  }

  // M1 (Revisor): React Router casa rotas case-insensitive; normalizar para o
  // guard não ser contornado por deep link com caixa alterada (/ADMIN/KANBAN).
  const normalized = pathname.toLowerCase().replace(/\/+$/, '')

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
    if (nivel === 'comercial') {
      // comercial: sem kanban de propostas, sem relatórios, sem whatsapp
      return seg === 'aprovacoes' || seg === 'parceiros' || seg === 'rede'
        || seg === 'propostas' || seg === 'prospeccao' || seg === 'universidade'
    }
    // limitado também acessa prospecção (S4); juridico NÃO
    if (seg === 'prospeccao') return nivel === 'limitado'
    // Comum a limitado e juridico (leitura).
    return seg === 'aprovacoes' || seg === 'parceiros' || seg === 'rede'
      || seg === 'kanban' || seg === 'propostas' || seg === 'relatorios'
  }

  if (segments.length === 2 && segments[0] === 'propostas') {
    if (segments[1] === 'nova') {
      // Criação de proposta: limitado e comercial (comercial cria via conversão do funil — S1).
      return nivel === 'limitado' || nivel === 'comercial'
    }
    // Detalhe de proposta (`propostas/:id`): limitado, juridico e comercial.
    return true
  }

  if (segments.length === 2 && segments[0] === 'integracoes' && segments[1] === 'whatsapp') {
    return nivel !== 'comercial' // comercial não tem WhatsApp (S2)
  }

  if (segments.length === 2 && segments[0] === 'leads' && segments[1] === 'simulacoes') {
    return true // todos os níveis restritos leem leads
  }

  if (segments.length === 2 && segments[0] === 'financeiro' && segments[1] === 'carteiras') {
    return nivel === 'comercial' // carteiras: só comercial (leitura); limitado/juridico não têm
  }

  if (segments.length === 3 && segments[0] === 'parceiros' && segments[2] === 'equipes') {
    return true
  }

  return false
}

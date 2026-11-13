import { describe, expect, it } from 'vitest'

import type { AdminNivel, AuthSession } from '@/auth/types'
import {
  adminNivelOf,
  canCreateProposta,
  isAdminPathAllowed,
  isRestrictedAdmin,
  isRestrictedAdminNavPath,
} from '@/lib/adminScope'

function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    id: 'u1',
    userId: 'u1',
    email: 'a@b.c',
    nome: 'Admin',
    role: 'admin',
    ativo: true,
    partnerId: null,
    partnerStatus: null,
    equipeId: null,
    approved: true,
    requiresTwoFactor: false,
    adminNivel: 'full',
    twoFactorVerified: true,
    twoFactorEnrolled: true,
    ...overrides,
  }
}

function admin(nivel: AdminNivel): AuthSession {
  return makeSession({ adminNivel: nivel })
}

describe('adminScope — escopo por admin_nivel', () => {
  it('adminNivelOf retorna null para não-admin e o nível para admin', () => {
    expect(adminNivelOf(null)).toBeNull()
    expect(adminNivelOf(makeSession({ role: 'partner' }))).toBeNull()
    expect(adminNivelOf(admin('full'))).toBe('full')
    expect(adminNivelOf(admin('limitado'))).toBe('limitado')
    expect(adminNivelOf(admin('juridico'))).toBe('juridico')
  })

  it('isRestrictedAdmin true apenas para limitado/juridico/comercial', () => {
    expect(isRestrictedAdmin(admin('full'))).toBe(false)
    expect(isRestrictedAdmin(admin('limitado'))).toBe(true)
    expect(isRestrictedAdmin(admin('juridico'))).toBe(true)
    expect(isRestrictedAdmin(admin('comercial'))).toBe(true)
    expect(isRestrictedAdmin(null)).toBe(false)
  })

  it('canCreateProposta: full, limitado e comercial (S1) — juridico não', () => {
    expect(canCreateProposta(admin('full'))).toBe(true)
    expect(canCreateProposta(admin('limitado'))).toBe(true)
    expect(canCreateProposta(admin('comercial'))).toBe(true)
    expect(canCreateProposta(admin('juridico'))).toBe(false)
    expect(canCreateProposta(null)).toBe(false)
  })

  it('comercial: nav inclui prospecção/carteiras/universidade; exclui kanban/relatorios/whatsapp', () => {
    for (const to of ['/admin', '/admin/aprovacoes', '/admin/parceiros', '/admin/rede', '/admin/propostas', '/admin/leads/simulacoes', '/admin/financeiro/carteiras', '/admin/universidade', '/admin/prospeccao']) {
      expect(isRestrictedAdminNavPath(to, 'comercial')).toBe(true)
    }
    for (const to of ['/admin/kanban', '/admin/relatorios', '/admin/integracoes/whatsapp', '/admin/financeiro', '/admin/configuracoes', '/admin/feature-flags']) {
      expect(isRestrictedAdminNavPath(to, 'comercial')).toBe(false)
    }
  })

  it('nav allowlist inclui propostas, leads e relatorios para escopo reduzido', () => {
    for (const to of ['/admin', '/admin/aprovacoes', '/admin/parceiros', '/admin/rede', '/admin/kanban', '/admin/propostas', '/admin/leads/simulacoes', '/admin/relatorios']) {
      expect(isRestrictedAdminNavPath(to)).toBe(true)
    }
    for (const to of ['/admin/financeiro', '/admin/configuracoes', '/admin/integracoes', '/admin/campanhas']) {
      expect(isRestrictedAdminNavPath(to)).toBe(false)
    }
  })

  it('nav por nível (S4, issue #34): limitado vê Prospecção no menu; juridico NÃO', () => {
    expect(isRestrictedAdminNavPath('/admin/prospeccao', 'limitado')).toBe(true)
    expect(isRestrictedAdminNavPath('/admin/prospeccao', 'juridico')).toBe(false)
    expect(isRestrictedAdminNavPath('/admin/prospeccao', 'comercial')).toBe(true)
    // demais itens do limitado preservados
    expect(isRestrictedAdminNavPath('/admin/relatorios', 'limitado')).toBe(true)
    expect(isRestrictedAdminNavPath('/admin/kanban', 'limitado')).toBe(true)
    expect(isRestrictedAdminNavPath('/admin/financeiro', 'limitado')).toBe(false)
    // chamada sem nível mantém a allowlist base (sem prospecção)
    expect(isRestrictedAdminNavPath('/admin/prospeccao')).toBe(false)
  })

  it('full acessa qualquer rota admin', () => {
    for (const p of ['/admin', '/admin/financeiro', '/admin/propostas/nova', '/admin/configuracoes']) {
      expect(isAdminPathAllowed(p, 'full')).toBe(true)
    }
  })

  it('limitado acessa leitura + criação de proposta, mas não telas operacionais sensíveis', () => {
    expect(isAdminPathAllowed('/admin', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/propostas', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/propostas/nova', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/propostas/abc-123', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/relatorios', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/leads/simulacoes', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/parceiros/p1/equipes', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/financeiro', 'limitado')).toBe(false)
    expect(isAdminPathAllowed('/admin/configuracoes', 'limitado')).toBe(false)
  })

  it('juridico lê propostas/relatorios mas NÃO cria proposta nova', () => {
    expect(isAdminPathAllowed('/admin/propostas', 'juridico')).toBe(true)
    expect(isAdminPathAllowed('/admin/propostas/abc-123', 'juridico')).toBe(true)
    expect(isAdminPathAllowed('/admin/relatorios', 'juridico')).toBe(true)
    expect(isAdminPathAllowed('/admin/leads/simulacoes', 'juridico')).toBe(true)
    expect(isAdminPathAllowed('/admin/propostas/nova', 'juridico')).toBe(false)
    expect(isAdminPathAllowed('/admin/financeiro', 'juridico')).toBe(false)
    expect(isAdminPathAllowed('/admin/prospeccao', 'juridico')).toBe(false) // juridico fora da prospecção (S4)
    expect(isAdminPathAllowed('/admin/prospeccao', 'limitado')).toBe(true) // limitado acessa prospecção (S4)
  })

  it('guard não é contornado por caixa do path (M1) — /ADMIN/KANBAN bloqueado p/ restrito', () => {
    expect(isAdminPathAllowed('/ADMIN/KANBAN', 'comercial')).toBe(false)
    expect(isAdminPathAllowed('/Admin/Financeiro', 'limitado')).toBe(false)
    expect(isAdminPathAllowed('/ADMIN/PROSPECCAO', 'comercial')).toBe(true)
  })

  it('comercial: allowlist de rotas (aprovacoes/parceiros/rede/propostas/leads/carteiras/universidade/prospeccao)', () => {
    for (const p of ['/admin', '/admin/aprovacoes', '/admin/parceiros', '/admin/rede', '/admin/propostas', '/admin/propostas/abc-123', '/admin/propostas/nova', '/admin/leads/simulacoes', '/admin/financeiro/carteiras', '/admin/universidade', '/admin/prospeccao', '/admin/parceiros/p1/equipes']) {
      expect(isAdminPathAllowed(p, 'comercial')).toBe(true)
    }
    for (const p of ['/admin/kanban', '/admin/relatorios', '/admin/integracoes/whatsapp', '/admin/financeiro', '/admin/financeiro/precos', '/admin/configuracoes', '/admin/feature-flags', '/admin/auditoria', '/admin/fluxos', '/admin/campanhas', '/admin/templates', '/admin/milestones']) {
      expect(isAdminPathAllowed(p, 'comercial')).toBe(false)
    }
  })
})

// R1 do plano 2026-11-12: nível desconhecido NÃO pode virar 'full' na UI.
describe('sanitizeAdminNivel (fallback seguro)', () => {
  it('reconhece os 4 níveis; desconhecido/ausente cai para full (comportamento legado documentado)', async () => {
    const { sanitizeAdminNivel } = await import('@/auth/authClient')
    expect(sanitizeAdminNivel('full')).toBe('full')
    expect(sanitizeAdminNivel('limitado')).toBe('limitado')
    expect(sanitizeAdminNivel('juridico')).toBe('juridico')
    expect(sanitizeAdminNivel('comercial')).toBe('comercial')
    // fallback legado: backend é a autoridade (RPCs restringem); UI assume full por padrão
    expect(sanitizeAdminNivel('superadmin')).toBe('full')
    expect(sanitizeAdminNivel(undefined)).toBe('full')
    expect(sanitizeAdminNivel(null)).toBe('full')
  })
})

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

  it('isRestrictedAdmin true apenas para limitado/juridico', () => {
    expect(isRestrictedAdmin(admin('full'))).toBe(false)
    expect(isRestrictedAdmin(admin('limitado'))).toBe(true)
    expect(isRestrictedAdmin(admin('juridico'))).toBe(true)
    expect(isRestrictedAdmin(null)).toBe(false)
  })

  it('canCreateProposta apenas full e limitado', () => {
    expect(canCreateProposta(admin('full'))).toBe(true)
    expect(canCreateProposta(admin('limitado'))).toBe(true)
    expect(canCreateProposta(admin('juridico'))).toBe(false)
    expect(canCreateProposta(null)).toBe(false)
  })

  it('nav allowlist inclui propostas e relatorios para escopo reduzido', () => {
    for (const to of ['/admin', '/admin/aprovacoes', '/admin/parceiros', '/admin/rede', '/admin/kanban', '/admin/propostas', '/admin/relatorios']) {
      expect(isRestrictedAdminNavPath(to)).toBe(true)
    }
    for (const to of ['/admin/financeiro', '/admin/configuracoes', '/admin/integracoes', '/admin/campanhas']) {
      expect(isRestrictedAdminNavPath(to)).toBe(false)
    }
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
    expect(isAdminPathAllowed('/admin/parceiros/p1/equipes', 'limitado')).toBe(true)
    expect(isAdminPathAllowed('/admin/financeiro', 'limitado')).toBe(false)
    expect(isAdminPathAllowed('/admin/configuracoes', 'limitado')).toBe(false)
  })

  it('juridico lê propostas/relatorios mas NÃO cria proposta nova', () => {
    expect(isAdminPathAllowed('/admin/propostas', 'juridico')).toBe(true)
    expect(isAdminPathAllowed('/admin/propostas/abc-123', 'juridico')).toBe(true)
    expect(isAdminPathAllowed('/admin/relatorios', 'juridico')).toBe(true)
    expect(isAdminPathAllowed('/admin/propostas/nova', 'juridico')).toBe(false)
    expect(isAdminPathAllowed('/admin/financeiro', 'juridico')).toBe(false)
  })
})

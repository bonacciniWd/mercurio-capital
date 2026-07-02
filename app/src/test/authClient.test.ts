import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
        listFactors: mocks.listFactors,
      },
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { fetchProfile, getCurrentSession } from '@/auth/authClient'

describe('authClient resiliente', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            email: 'partner@mercurio.test',
            app_metadata: {
              role: 'partner',
              approved: true,
              partner_id: 'partner-1',
            },
          },
        },
      },
      error: null,
    })

    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    })

    mocks.listFactors.mockResolvedValue({
      data: { totp: [] },
      error: null,
    })

    mocks.signOut.mockResolvedValue({ error: null })
  })

  it('usa fallback de sessão quando me() falha por erro transitório', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Load failed' },
    })

    const profile = await fetchProfile()

    expect(profile).not.toBeNull()
    expect(profile?.role).toBe('partner')
    expect(profile?.partnerId).toBe('partner-1')
  })

  it('não executa signOut local em falha transitória no bootstrap', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Load failed' },
    })

    const session = await getCurrentSession()

    expect(session).not.toBeNull()
    expect(session?.role).toBe('partner')
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('retorna null em erro permanente de me()', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    })

    const profile = await fetchProfile()

    expect(profile).toBeNull()
  })
})

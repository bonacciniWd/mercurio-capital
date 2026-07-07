import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
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
        enroll: mocks.enroll,
        unenroll: mocks.unenroll,
        challenge: mocks.challenge,
        verify: mocks.verify,
      },
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { enrollTwoFactor, fetchProfile, getCurrentSession, unenrollTwoFactor } from '@/auth/authClient'

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

    mocks.enroll.mockResolvedValue({
      data: {
        id: 'factor-1',
        friendly_name: 'Mercurio TOTP',
        totp: {
          qr_code: '<svg />',
          secret: 'ABCDEF123456',
          uri: 'otpauth://totp/Mercurio',
        },
      },
      error: null,
    })

    mocks.unenroll.mockResolvedValue({ error: null })

    mocks.challenge.mockResolvedValue({
      data: { id: 'challenge-1' },
      error: null,
    })

    mocks.verify.mockResolvedValue({ error: null })

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

  it('remove fatores pendentes antes de iniciar novo cadastro TOTP', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        totp: [
          {
            id: 'factor-pending-1',
            status: 'unverified',
            friendly_name: 'Mercurio TOTP',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      error: null,
    })

    await enrollTwoFactor('Mercurio TOTP')

    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: 'factor-pending-1' })
  })

  it('faz retry com nome único quando friendly name já existe', async () => {
    mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null })

    mocks.enroll
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'A factor with the friendly name already exists' },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'factor-2',
          friendly_name: 'Mercurio TOTP 2026-07-06T12-00-00-000Z',
          totp: {
            qr_code: '<svg />',
            secret: 'XYZ123456789',
            uri: 'otpauth://totp/Mercurio-2',
          },
        },
        error: null,
      })

    const enrollment = await enrollTwoFactor('Mercurio TOTP')

    expect(mocks.enroll).toHaveBeenCalledTimes(2)
    expect(mocks.enroll).toHaveBeenNthCalledWith(1, {
      factorType: 'totp',
      friendlyName: 'Mercurio TOTP',
    })
    expect(mocks.enroll.mock.calls[1]?.[0]?.friendlyName).toContain('Mercurio TOTP')
    expect(enrollment.factorId).toBe('factor-2')
  })

  it('remove fator verificado com step-up AAL2 quando Supabase exigir confirmação', async () => {
    mocks.unenroll
      .mockResolvedValueOnce({ error: { message: 'AAL2 required to unenroll verified factor' } })
      .mockResolvedValueOnce({ error: null })

    await unenrollTwoFactor('factor-verified-1', '123456')

    expect(mocks.challenge).toHaveBeenCalledWith({ factorId: 'factor-verified-1' })
    expect(mocks.verify).toHaveBeenCalledWith({
      factorId: 'factor-verified-1',
      challengeId: 'challenge-1',
      code: '123456',
    })
    expect(mocks.unenroll).toHaveBeenCalledTimes(2)
  })

  it('retorna erro amigável quando AAL2 é obrigatório e o código não foi informado', async () => {
    mocks.unenroll.mockResolvedValueOnce({ error: { message: 'AAL2 required to unenroll verified factor' } })

    await expect(unenrollTwoFactor('factor-verified-2')).rejects.toMatchObject({
      message: 'Confirme com o código de 6 dígitos do app autenticador para remover este fator.',
      code: 'AAL2_REQUIRED_FOR_UNENROLL',
    })

    expect(mocks.challenge).not.toHaveBeenCalled()
    expect(mocks.verify).not.toHaveBeenCalled()
  })
})

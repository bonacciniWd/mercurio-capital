import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  getMessaging: vi.fn(() => ({})),
  initializeApp: vi.fn(() => ({})),
  rpc: vi.fn(),
}))

vi.mock('firebase/app', () => ({ initializeApp: mocks.initializeApp }))
vi.mock('firebase/messaging', () => ({
  getMessaging: mocks.getMessaging,
  getToken: mocks.getToken,
  deleteToken: mocks.deleteToken,
}))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { initPushWeb, pushWebSuportado, revokePushWeb } from '@/lib/pushWeb'

const envCompleto = { protocol: 'https:', serviceWorker: true, pushManager: true, notification: true, electronUA: false }

function stubBrowser(permission: 'granted' | 'default') {
  Object.defineProperty(window, 'Notification', {
    value: { permission }, configurable: true, writable: true,
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register: mocks.register }, configurable: true,
  })
  Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true, writable: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'api-key')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'mercurio-teste')
  vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456')
  vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123456:web:abc')
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'vapid-publica')
  mocks.register.mockResolvedValue({})
  mocks.getToken.mockResolvedValue('fcm-token-123')
  mocks.rpc.mockResolvedValue({ data: null, error: null })
})

describe('pushWebSuportado', () => {
  it('bloqueia Electron (file:// ou build desktop) e navegador sem APIs', () => {
    expect(pushWebSuportado({ ...envCompleto, protocol: 'file:' })).toBe(false)
    expect(pushWebSuportado(envCompleto, 'desktop')).toBe(false)
    expect(pushWebSuportado({ ...envCompleto, serviceWorker: false })).toBe(false)
    expect(pushWebSuportado({ ...envCompleto, pushManager: false })).toBe(false)
    expect(pushWebSuportado({ ...envCompleto, notification: false })).toBe(false)
    expect(pushWebSuportado({ ...envCompleto, electronUA: true })).toBe(false) // dev desktop
    expect(pushWebSuportado(envCompleto)).toBe(true)
  })
})

describe('initPushWeb', () => {
  it('é no-op sem config pública do Firebase', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    stubBrowser('granted')
    await initPushWeb()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('não registra nada sem permissão prévia (prompt é a issue #14)', async () => {
    stubBrowser('default')
    await initPushWeb()
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.getToken).not.toHaveBeenCalled()
  })

  it('com permissão concedida: registra SW com config via query string e faz upsert do token', async () => {
    stubBrowser('granted')
    await initPushWeb()
    expect(mocks.register).toHaveBeenCalledTimes(1)
    const swUrl = mocks.register.mock.calls[0][0] as string
    expect(swUrl).toContain('/firebase-messaging-sw.js?')
    expect(swUrl).toContain('projectId=mercurio-teste')
    expect(swUrl).not.toContain('vapid') // vapid fica fora da URL do SW
    expect(mocks.getToken).toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith('push_subscription_upsert', {
      p_token: 'fcm-token-123',
      p_user_agent: navigator.userAgent,
    })
  })

  it('falha do FCM não propaga exceção nem chama RPC', async () => {
    stubBrowser('granted')
    mocks.getToken.mockRejectedValue(new Error('fcm fora do ar'))
    await expect(initPushWeb()).resolves.toBeUndefined()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('revokePushWeb', () => {
  it('revoga no servidor e descarta o token local', async () => {
    stubBrowser('granted')
    await initPushWeb()
    mocks.rpc.mockClear()
    await revokePushWeb()
    expect(mocks.rpc).toHaveBeenCalledWith('push_subscription_revogar', { p_token: 'fcm-token-123' })
    expect(mocks.deleteToken).toHaveBeenCalled()
  })

  it('sem token registrado, não chama o servidor', async () => {
    stubBrowser('granted')
    await revokePushWeb()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

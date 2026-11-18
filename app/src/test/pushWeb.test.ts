import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  onMessage: vi.fn(() => vi.fn()),
  showNotification: vi.fn(),
  getMessaging: vi.fn(() => ({})),
  initializeApp: vi.fn(() => ({})),
  rpc: vi.fn(),
}))

vi.mock('firebase/app', () => ({ initializeApp: mocks.initializeApp }))
vi.mock('firebase/messaging', () => ({
  getMessaging: mocks.getMessaging,
  getToken: mocks.getToken,
  deleteToken: mocks.deleteToken,
  onMessage: mocks.onMessage,
}))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

let pushWeb: typeof import('@/lib/pushWeb')

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
  mocks.register.mockResolvedValue({ showNotification: mocks.showNotification })
  mocks.getToken.mockResolvedValue('fcm-token-123')
  mocks.rpc.mockResolvedValue({ data: null, error: null })
})

beforeEach(async () => {
  vi.resetModules()
  pushWeb = await import('@/lib/pushWeb')
})

describe('pushWebSuportado', () => {
  it('bloqueia Electron (file:// ou build desktop) e navegador sem APIs', () => {
    expect(pushWeb.pushWebSuportado({ ...envCompleto, protocol: 'file:' })).toBe(false)
    expect(pushWeb.pushWebSuportado(envCompleto, 'desktop')).toBe(false)
    expect(pushWeb.pushWebSuportado({ ...envCompleto, serviceWorker: false })).toBe(false)
    expect(pushWeb.pushWebSuportado({ ...envCompleto, pushManager: false })).toBe(false)
    expect(pushWeb.pushWebSuportado({ ...envCompleto, notification: false })).toBe(false)
    expect(pushWeb.pushWebSuportado({ ...envCompleto, electronUA: true })).toBe(false) // dev desktop
    expect(pushWeb.pushWebSuportado(envCompleto)).toBe(true)
  })
})

describe('initPushWeb', () => {
  it('é no-op sem config pública do Firebase', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    stubBrowser('granted')
    await pushWeb.initPushWeb()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('não registra nada sem permissão prévia (prompt é a issue #14)', async () => {
    stubBrowser('default')
    await pushWeb.initPushWeb()
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.getToken).not.toHaveBeenCalled()
  })

  it('com permissão concedida: registra SW com config via query string e faz upsert do token', async () => {
    stubBrowser('granted')
    await pushWeb.initPushWeb()
    await pushWeb.initPushWeb()
    expect(mocks.register).toHaveBeenCalledTimes(2)
    const swUrl = mocks.register.mock.calls[0][0] as string
    expect(swUrl).toContain('/firebase-messaging-sw.js?')
    expect(swUrl).toContain('projectId=mercurio-teste')
    expect(swUrl).not.toContain('vapid') // vapid fica fora da URL do SW
    expect(mocks.getToken).toHaveBeenCalled()
    expect(mocks.onMessage).toHaveBeenCalledTimes(1)
    const foregroundHandler = (mocks.onMessage.mock.calls[0] as unknown as [
      unknown,
      (payload: { data?: Record<string, string> }) => Promise<void>,
    ])[1]
    await foregroundHandler({ data: { titulo: 'Aviso de teste', mensagem: 'Push em primeiro plano', link: '/admin' } })
    expect(mocks.showNotification).toHaveBeenCalledWith('Aviso de teste', {
      body: 'Push em primeiro plano',
      icon: '/mercurio-icon.png',
      data: { link: '/admin' },
    })
    expect(mocks.rpc).toHaveBeenCalledWith('push_subscription_upsert', {
      p_token: 'fcm-token-123',
      p_user_agent: navigator.userAgent,
    })
  })

  it('não duplica listener quando a inicialização ocorre em paralelo', async () => {
    stubBrowser('granted')
    await Promise.all([pushWeb.initPushWeb(), pushWeb.initPushWeb()])
    expect(mocks.onMessage).toHaveBeenCalledTimes(1)
  })

  it('falha do FCM não propaga exceção nem chama RPC', async () => {
    stubBrowser('granted')
    mocks.getToken.mockRejectedValue(new Error('fcm fora do ar'))
    await expect(pushWeb.initPushWeb()).resolves.toBeUndefined()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('revokePushWeb', () => {
  it('revoga no servidor e descarta o token local', async () => {
    stubBrowser('granted')
    await pushWeb.initPushWeb()
    mocks.rpc.mockClear()
    const stopListener = mocks.onMessage.mock.results[0]?.value as ReturnType<typeof vi.fn>
    await pushWeb.revokePushWeb()
    expect(mocks.rpc).toHaveBeenCalledWith('push_subscription_revogar', { p_token: 'fcm-token-123' })
    expect(mocks.deleteToken).toHaveBeenCalled()
    expect(stopListener).toHaveBeenCalledTimes(1)
  })

  it('sem token registrado, não chama o servidor', async () => {
    stubBrowser('granted')
    await pushWeb.revokePushWeb()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

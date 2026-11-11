import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({
  requestPushPermission: vi.fn(),
  initPushWeb: vi.fn(),
  revokePushWeb: vi.fn(),
  setPushDeviceOff: vi.fn(),
  isPushDeviceOff: vi.fn(() => false),
  rpc: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@/lib/pushWeb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pushWeb')>('@/lib/pushWeb')
  return {
    ...actual,
    requestPushPermission: mocks.requestPushPermission,
    initPushWeb: mocks.initPushWeb,
    revokePushWeb: mocks.revokePushWeb,
    setPushDeviceOff: mocks.setPushDeviceOff,
    isPushDeviceOff: mocks.isPushDeviceOff,
    pushWebSuportado: () => true,
    pushWebConfigurado: () => true,
  }
})
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ session: { userId: 'u1', role: 'partner' } }),
}))
vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => true }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.select }) }),
    }),
  },
}))

import { PushOptIn } from '@/components/PushOptIn'
import { contarSessao, deveExibirPrompt } from '@/lib/pushOptInRules'
import { PushBrowserSection } from '@/components/PushBrowserSection'
import { PushClientCard } from '@/components/PushClientCard'

const DIA = 24 * 60 * 60 * 1000
const AGORA = Date.parse('2026-11-11T12:00:00Z')

function renderComClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function setPermission(value: NotificationPermission) {
  Object.defineProperty(window, 'Notification', {
    value: { permission: value, requestPermission: mocks.requestPushPermission },
    configurable: true, writable: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mocks.isPushDeviceOff.mockReturnValue(false)
  mocks.select.mockResolvedValue({ data: { push_opt_out: false }, error: null })
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  mocks.requestPushPermission.mockResolvedValue('granted')
  Object.defineProperty(navigator, 'serviceWorker', { value: { register: vi.fn() }, configurable: true })
  Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true, writable: true })
})

describe('regras do banner (contagem e backoff)', () => {
  it('não exibe na 1ª sessão; exibe a partir da 2ª (janela de 12h)', () => {
    expect(contarSessao('u1', AGORA)).toBe(1)
    expect(deveExibirPrompt('u1', AGORA)).toBe(false)
    expect(contarSessao('u1', AGORA + 60_000)).toBe(1) // refresh não infla
    expect(contarSessao('u1', AGORA + 13 * 60 * 60 * 1000)).toBe(2)
    expect(deveExibirPrompt('u1', AGORA + 13 * 60 * 60 * 1000)).toBe(true)
  })

  it('respeita never, máx. 3 dismisses e janela de 14 dias', () => {
    contarSessao('u1', AGORA)
    contarSessao('u1', AGORA + 13 * 60 * 60 * 1000)
    window.localStorage.setItem('mercurio:push_prompt_v1:u1', JSON.stringify({ v: 1, dismisses: 1, last: new Date(AGORA).toISOString(), never: false }))
    expect(deveExibirPrompt('u1', AGORA + 2 * DIA)).toBe(false) // dentro de 14d
    expect(deveExibirPrompt('u1', AGORA + 15 * DIA)).toBe(true) // backoff expirou
    window.localStorage.setItem('mercurio:push_prompt_v1:u1', JSON.stringify({ v: 1, dismisses: 3, last: null, never: false }))
    expect(deveExibirPrompt('u1', AGORA + 60 * DIA)).toBe(false) // 3× = nunca mais
    window.localStorage.setItem('mercurio:push_prompt_v1:u1', JSON.stringify({ v: 1, dismisses: 0, last: null, never: true }))
    expect(deveExibirPrompt('u1', AGORA + 60 * DIA)).toBe(false)
  })

  it('estado é por usuário (máquina compartilhada não vaza entre contas)', () => {
    contarSessao('u1', AGORA)
    contarSessao('u1', AGORA + 13 * 60 * 60 * 1000)
    expect(deveExibirPrompt('u2', AGORA + 13 * 60 * 60 * 1000)).toBe(false)
  })
})

describe('guard P-4 (bloqueio local durável)', () => {
  it('setPushDeviceOff liga/desliga e isPushDeviceOff lê', () => {
    // usa a implementação real exportada (o mock só intercepta os spies do componente)
    const real = vi.importActual<typeof import('@/lib/pushWeb')>('@/lib/pushWeb')
    return real.then(({ isPushDeviceOff: realOff, setPushDeviceOff: realSet }) => {
      expect(realOff('u9')).toBe(false)
      realSet('u9', true)
      expect(realOff('u9')).toBe(true)
      expect(realOff('u8')).toBe(false) // por usuário
      realSet('u9', false)
      expect(realOff('u9')).toBe(false)
    })
  })
})

describe('PushOptIn (componente)', () => {
  it('não renderiza na 1ª sessão e renderiza na 2ª', () => {
    setPermission('default')
    const { unmount } = render(<PushOptIn />)
    expect(screen.queryByText('Receba alertas mesmo com a aba fechada')).toBeNull()
    unmount()
    // usa o relógio real: o 1º render já contou a sessão 1 com Date.now()
    contarSessao('u1', Date.now() + 13 * 60 * 60 * 1000)
    render(<PushOptIn />)
    expect(screen.getByText('Receba alertas mesmo com a aba fechada')).toBeInTheDocument()
  })

  it('ativar com sucesso: feedback e nunca mais exibir', async () => {
    setPermission('default')
    contarSessao('u1', AGORA)
    contarSessao('u1', AGORA + 13 * 60 * 60 * 1000)
    render(<PushOptIn />)
    fireEvent.click(screen.getByText('Ativar notificações'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ativadas'))
    expect(mocks.requestPushPermission).toHaveBeenCalledTimes(1)
    expect(deveExibirPrompt('u1', AGORA + 30 * DIA)).toBe(false) // never=true
  })

  it('"Agora não" registra dismiss e esconde', async () => {
    setPermission('default')
    contarSessao('u1', AGORA)
    contarSessao('u1', AGORA + 13 * 60 * 60 * 1000)
    render(<PushOptIn />)
    fireEvent.click(screen.getByText('Agora não'))
    await waitFor(() => expect(screen.queryByText('Receba alertas mesmo com a aba fechada')).toBeNull())
    const state = JSON.parse(window.localStorage.getItem('mercurio:push_prompt_v1:u1')!)
    expect(state.dismisses).toBe(1)
    expect(state.never).toBe(false)
  })
})

describe('PushBrowserSection (matriz de estados)', () => {
  it('B3: nunca perguntado → CTA Ativar', () => {
    setPermission('default')
    renderComClient(<PushBrowserSection />)
    expect(screen.getByText('Não ativadas.', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ativar notificações/ })).toBeInTheDocument()
  })

  it('B1: ativo → Desativar neste navegador', async () => {
    setPermission('granted')
    renderComClient(<PushBrowserSection />)
    expect(await screen.findByText('Ativadas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Desativar neste navegador/ }))
    await waitFor(() => expect(mocks.revokePushWeb).toHaveBeenCalled())
    expect(mocks.setPushDeviceOff).toHaveBeenCalledWith('u1', true)
  })

  it('B2: desligado neste navegador → Reativar re-registra', async () => {
    setPermission('granted')
    mocks.isPushDeviceOff.mockReturnValue(true)
    renderComClient(<PushBrowserSection />)
    expect(await screen.findByText('Desativadas neste navegador.', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reativar notificações/ }))
    await waitFor(() => expect(mocks.initPushWeb).toHaveBeenCalled())
    expect(mocks.setPushDeviceOff).toHaveBeenCalledWith('u1', false)
  })

  it('B4: negado → instruções sem botão de ação', () => {
    setPermission('denied')
    renderComClient(<PushBrowserSection />)
    expect(screen.getByText('Bloqueadas pelo navegador')).toBeInTheDocument()
    expect(screen.getByText(/Chrome\/Edge/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ativar|Reativar|Desativar/ })).toBeNull()
  })

  it('toggle mestre grava via RPC na hora', async () => {
    setPermission('granted')
    renderComClient(<PushBrowserSection />)
    const toggle = await screen.findByRole('checkbox')
    fireEvent.click(toggle) // desliga o mestre
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('push_preferencia_set', { p_opt_out: true }))
  })
})

describe('PushClientCard (regressão M-1)', () => {
  it('RPC falhando mostra erro e NÃO exibe falso sucesso ao desativar', async () => {
    setPermission('granted')
    mocks.rpc.mockRejectedValue(new Error('rede fora'))
    renderComClient(<PushClientCard />)
    fireEvent.click(await screen.findByRole('button', { name: /Desativar/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar'))
    expect(screen.queryByText(/desativadas em todos/i)).toBeNull()
  })
})

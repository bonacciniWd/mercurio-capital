import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DesktopUpdateWidget } from '@/components/DesktopUpdateWidget'

const WIDGET_HIDDEN_STORAGE_KEY = 'mercurio:desktop_update_widget_hidden_v1'

function makeState(overrides: Partial<DesktopUpdateState> = {}): DesktopUpdateState {
  return {
    channel: 'stable',
    status: 'no-update',
    currentVersion: '0.0.4',
    latestVersion: null,
    message: 'Você já está na versão mais recente do canal Stable.',
    checkReason: 'manual',
    progressPercent: 0,
    bytesPerSecond: 0,
    transferredBytes: 0,
    totalBytes: 0,
    retryAttempt: 0,
    retryMaxAttempts: 4,
    retryNextDelayMs: null,
    lastCheckedAt: new Date().toISOString(),
    lastError: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function mountDesktopBridge(initialState: DesktopUpdateState) {
  let currentState = initialState
  let listener: ((next: DesktopUpdateState) => void) | null = null

  const checkNow = vi.fn(async () => ({ ok: true, state: currentState }))
  const installNow = vi.fn(async () => ({ ok: true, state: currentState }))

  const updatesApi: DesktopUpdatesApi = {
    getState: vi.fn(async () => currentState),
    checkNow,
    installNow,
    onStateChange: vi.fn((callback) => {
      listener = callback
      return () => {
        if (listener === callback) {
          listener = null
        }
      }
    }),
  }

  window.desktop = {
    platform: 'darwin',
    updateChannel: 'stable',
    updates: updatesApi,
  }

  return {
    checkNow,
    installNow,
    emit(nextPatch: Partial<DesktopUpdateState>) {
      currentState = {
        ...currentState,
        ...nextPatch,
        updatedAt: new Date().toISOString(),
      }
      listener?.(currentState)
    },
  }
}

describe('DesktopUpdateWidget hide/show', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.desktop = undefined
  })

  it('permite ocultar, reabrir e manter check/install funcionando', async () => {
    const desktopBridge = mountDesktopBridge(makeState({ status: 'no-update' }))

    render(<DesktopUpdateWidget />)
    await screen.findByText('Atualização Desktop')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar widget de atualização' }))
    expect(screen.queryByText('Atualização Desktop')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar widget de atualização' }))
    await screen.findByText('Atualização Desktop')

    fireEvent.click(screen.getByRole('button', { name: 'Verificar agora' }))
    await waitFor(() => {
      expect(desktopBridge.checkNow).toHaveBeenCalledTimes(1)
    })

    act(() => {
      desktopBridge.emit({
        status: 'downloaded',
        latestVersion: '0.0.4',
        message: 'Atualização pronta para instalar.',
      })
    })

    await screen.findByRole('button', { name: 'Instalar e reiniciar' })

    fireEvent.click(screen.getByRole('button', { name: 'Instalar e reiniciar' }))
    await waitFor(() => {
      expect(desktopBridge.installNow).toHaveBeenCalledTimes(1)
    })
  })

  it('auto reabre quando atualizacao fica pronta mesmo com widget oculto', async () => {
    window.localStorage.setItem(WIDGET_HIDDEN_STORAGE_KEY, '1')

    const desktopBridge = mountDesktopBridge(makeState({ status: 'no-update' }))

    render(<DesktopUpdateWidget />)
    await screen.findByRole('button', { name: 'Mostrar widget de atualização' })

    act(() => {
      desktopBridge.emit({
        status: 'downloaded',
        latestVersion: '0.0.4',
        message: 'Atualização pronta para instalar.',
      })
    })

    await screen.findByText('Atualização Desktop')
    expect(window.localStorage.getItem(WIDGET_HIDDEN_STORAGE_KEY)).toBeNull()
  })
})
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { AppUpdater } = require('electron-updater/out/AppUpdater.js')
const { parse } = createRequire(require.resolve('electron-updater/out/AppUpdater.js'))('semver')

interface TestUpdater {
  channel: string
  allowDowngrade: boolean
  currentVersion: unknown
  on: ReturnType<typeof vi.fn>
  checkForUpdates: ReturnType<typeof vi.fn>
  isUpdateSupported: () => boolean
  isUserWithinRollout: () => boolean
  isUpdateAvailable: (info: { version: string }) => Promise<boolean>
}

describe('desktop updater version policy', () => {
  it('blocks older and equal versions while allowing newer versions after channel setup', async () => {
    // Use the installed library setter and version policy, without network or Electron.
    const updater = Object.create(AppUpdater.prototype) as TestUpdater
    Object.assign(updater, {
      currentVersion: parse('0.3.2'),
      on: vi.fn(),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      isUpdateSupported: () => true,
      isUserWithinRollout: () => true,
    })
    updater.allowDowngrade = false
    updater.channel = 'stable'
    expect(updater.allowDowngrade).toBe(true) // reproduces the library side effect

    const module = { exports: {} as { setupDesktopUpdater: (options: { channel: string; getWindows: () => [] }) => void } }
    runInNewContext(readFileSync(path.resolve('desktop/electron/updater.cjs'), 'utf8'), {
      module,
      require: (id: string) => {
        if (id === 'electron') return { app: { isPackaged: true, getVersion: () => '0.3.2' }, ipcMain: { handle: vi.fn() } }
        if (id === 'electron-updater') return { autoUpdater: updater }
        throw new Error(`Unexpected dependency: ${id}`)
      },
      setTimeout,
      clearTimeout,
      setImmediate,
    })
    module.exports.setupDesktopUpdater({ channel: 'stable', getWindows: () => [] })
    expect(updater.channel).toBe('stable')
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.checkForUpdates).toHaveBeenCalledOnce()
    await expect(updater.isUpdateAvailable({ version: '0.3.1' })).resolves.toBe(false)
    await expect(updater.isUpdateAvailable({ version: '0.3.2' })).resolves.toBe(false)
    await expect(updater.isUpdateAvailable({ version: '0.3.3' })).resolves.toBe(true)
  })
})

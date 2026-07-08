import { describe, expect, it, vi } from 'vitest'

import { applyDesktopInitialPath, resolveDesktopInitialPath } from '@/lib/desktopInitialPath'

function makeLocation(overrides: Partial<Pick<Location, 'protocol' | 'pathname' | 'search'>> = {}) {
  return {
    protocol: 'file:',
    pathname: '/Applications/Mercurio Capital.app/Contents/Resources/app.asar/dist/index.html',
    search: '?initialPath=%2Fp%2Flogin',
    ...overrides,
  } as Pick<Location, 'protocol' | 'pathname' | 'search'>
}

describe('desktop initial path bootstrap', () => {
  it('resolve /p/login para app empacotado com file://', () => {
    const locationLike = makeLocation()

    expect(resolveDesktopInitialPath(locationLike)).toBe('/p/login')
  })

  it('ignora protocolos nao-file ou ausencia de initialPath', () => {
    expect(resolveDesktopInitialPath(makeLocation({ protocol: 'http:' }))).toBeNull()
    expect(resolveDesktopInitialPath(makeLocation({ search: '' }))).toBeNull()
    expect(resolveDesktopInitialPath(makeLocation({ pathname: '/dist/app.html' }))).toBeNull()
  })

  it('aplica replaceState quando o target e valido', () => {
    const replaceState = vi.fn()
    const historyLike = { replaceState } as Pick<History, 'replaceState'>

    const applied = applyDesktopInitialPath(makeLocation(), historyLike)

    expect(applied).toBe(true)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/p/login')
  })
})
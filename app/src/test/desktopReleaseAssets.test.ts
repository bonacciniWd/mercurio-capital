import { describe, expect, it } from 'vitest'

import {
  buildDownloadsFromRelease,
  formatFileSize,
  type PublicRelease,
} from '@/lib/desktopReleaseAssets'

function makeRelease(assetNames: string[]): PublicRelease {
  return {
    tag_name: 'v0.0.3-test',
    name: 'Desktop Test Release',
    published_at: '2026-07-08T00:00:00Z',
    assets: assetNames.map((name, index) => ({
      name,
      browser_download_url: `https://example.com/download/${encodeURIComponent(name)}`,
      size: (index + 1) * 1024,
    })),
  }
}

describe('desktop release assets parser', () => {
  it('mapeia mac arm64/x64, windows x64, appimage e deb', () => {
    const release = makeRelease([
      'stable.yml',
      'Mercurio.Capital-0.0.2-arm64.dmg',
      'Mercurio.Capital-0.0.2.dmg',
      'Mercurio.Capital.Setup.0.0.2.exe',
      'Mercurio.Capital-0.0.2.AppImage',
      'mercurio-capital-app_0.0.2_amd64.deb',
      'sha256sums.txt',
    ])

    const downloads = buildDownloadsFromRelease(release)

    expect(downloads.mac[0].available).toBe(true)
    expect(downloads.mac[0].fileName).toBe('Mercurio.Capital-0.0.2-arm64.dmg')

    expect(downloads.mac[1].available).toBe(true)
    expect(downloads.mac[1].fileName).toBe('Mercurio.Capital-0.0.2.dmg')

    expect(downloads.windows[0].available).toBe(true)
    expect(downloads.windows[0].fileName).toBe('Mercurio.Capital.Setup.0.0.2.exe')

    expect(downloads.linux[0].available).toBe(true)
    expect(downloads.linux[0].fileName).toBe('Mercurio.Capital-0.0.2.AppImage')

    expect(downloads.linux[1].available).toBe(true)
    expect(downloads.linux[1].fileName).toBe('mercurio-capital-app_0.0.2_amd64.deb')
  })

  it('mantem fallback resiliente quando assets esperados estao ausentes', () => {
    const release = makeRelease([
      'Mercurio.Capital.Setup.0.0.2.exe',
      'stable.yml',
    ])

    const downloads = buildDownloadsFromRelease(release)

    expect(downloads.windows[0].available).toBe(true)

    expect(downloads.mac[0].available).toBe(false)
    expect(downloads.mac[0].url).toBe('#indisponivel')

    expect(downloads.mac[1].available).toBe(false)
    expect(downloads.linux[0].available).toBe(false)
    expect(downloads.linux[1].available).toBe(false)
  })
})

describe('formatFileSize', () => {
  it('retorna string vazia para entradas invalidas', () => {
    expect(formatFileSize()).toBe('')
    expect(formatFileSize(0)).toBe('')
    expect(formatFileSize(-1)).toBe('')
  })

  it('formata tamanhos em unidades humanas', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB')
    expect(formatFileSize(1024 * 1024 * 12)).toBe('12.0 MB')
  })
})
export type Platform = 'mac' | 'windows' | 'linux'

export type ReleaseAsset = {
  name: string
  browser_download_url: string
  size: number
}

export type PublicRelease = {
  tag_name: string
  name: string
  published_at: string | null
  assets: ReleaseAsset[]
}

export type DownloadOption = {
  url: string
  label: string
  ext: string
  arch?: string
  available: boolean
  fileName?: string
  size?: number
}

export type DownloadMatrix = Record<Platform, DownloadOption[]>

const FALLBACK_DOWNLOADS: DownloadMatrix = {
  mac: [
    { url: '#indisponivel', label: 'macOS (Apple Silicon)', ext: '.dmg', arch: 'arm64', available: false },
    { url: '#indisponivel', label: 'macOS (Intel)', ext: '.dmg', arch: 'x64', available: false },
  ],
  windows: [
    { url: '#indisponivel', label: 'Windows 10/11', ext: '.exe', arch: 'x64', available: false },
  ],
  linux: [
    { url: '#indisponivel', label: 'Linux (AppImage)', ext: '.AppImage', arch: 'x64', available: false },
    { url: '#indisponivel', label: 'Debian / Ubuntu', ext: '.deb', arch: 'x64', available: false },
  ],
}

export function createFallbackMatrix(): DownloadMatrix {
  return {
    mac: FALLBACK_DOWNLOADS.mac.map(item => ({ ...item })),
    windows: FALLBACK_DOWNLOADS.windows.map(item => ({ ...item })),
    linux: FALLBACK_DOWNLOADS.linux.map(item => ({ ...item })),
  }
}

export async function fetchLatestDesktopRelease(owner: string, repo: string): Promise<PublicRelease> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`Falha ao carregar release publico (${response.status})`)
  }

  const payload = await response.json() as Partial<PublicRelease>
  if (!payload || !Array.isArray(payload.assets)) {
    throw new Error('Payload de release invalido')
  }

  return {
    tag_name: payload.tag_name ?? 'latest',
    name: payload.name ?? 'Release',
    published_at: payload.published_at ?? null,
    assets: payload.assets.filter((asset): asset is ReleaseAsset => {
      return (
        typeof asset?.name === 'string' &&
        typeof asset?.browser_download_url === 'string' &&
        typeof asset?.size === 'number'
      )
    }),
  }
}

function assignAsset(option: DownloadOption, asset: ReleaseAsset | null) {
  if (!asset) return
  option.available = true
  option.url = asset.browser_download_url
  option.fileName = asset.name
  option.size = asset.size
}

export function buildDownloadsFromRelease(release?: PublicRelease): DownloadMatrix {
  const matrix = createFallbackMatrix()
  if (!release) return matrix

  const pool = [...release.assets]
  const take = (predicate: (asset: ReleaseAsset) => boolean): ReleaseAsset | null => {
    const index = pool.findIndex(predicate)
    if (index < 0) return null
    const [asset] = pool.splice(index, 1)
    return asset
  }

  const isDmg = (asset: ReleaseAsset) => /\.dmg$/i.test(asset.name)
  const isArm64 = (asset: ReleaseAsset) => /arm64/i.test(asset.name)

  assignAsset(matrix.mac[0], take(asset => isDmg(asset) && isArm64(asset)))
  assignAsset(matrix.mac[1], take(asset => isDmg(asset) && !isArm64(asset)))

  assignAsset(
    matrix.windows[0],
    take(asset => /setup/i.test(asset.name) && /\.exe$/i.test(asset.name)) ??
      take(asset => /\.exe$/i.test(asset.name)),
  )

  assignAsset(matrix.linux[0], take(asset => /\.appimage$/i.test(asset.name)))
  assignAsset(
    matrix.linux[1],
    take(asset => /_amd64\.deb$/i.test(asset.name)) ?? take(asset => /\.deb$/i.test(asset.name)),
  )

  return matrix
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}
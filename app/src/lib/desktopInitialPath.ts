type DesktopLocationLike = Pick<Location, 'protocol' | 'pathname' | 'search'>
type DesktopHistoryLike = Pick<History, 'replaceState'>

export function resolveDesktopInitialPath(locationLike: DesktopLocationLike): string | null {
  if (locationLike.protocol !== 'file:' || !locationLike.pathname.endsWith('/index.html')) {
    return null
  }

  const initialPath = new URLSearchParams(locationLike.search).get('initialPath')
  if (!initialPath) {
    return null
  }

  return initialPath.startsWith('/') ? initialPath : `/${initialPath}`
}

export function applyDesktopInitialPath(
  locationLike: DesktopLocationLike | null = typeof window !== 'undefined' ? window.location : null,
  historyLike: DesktopHistoryLike | null = typeof window !== 'undefined' ? window.history : null,
) {
  if (!locationLike || !historyLike) {
    return false
  }

  const targetPath = resolveDesktopInitialPath(locationLike)
  if (!targetPath) {
    return false
  }

  historyLike.replaceState(null, '', locationLike.pathname + '#' + targetPath)
  return true
}
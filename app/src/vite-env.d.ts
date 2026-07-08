/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type DesktopUpdateReason = 'startup' | 'manual' | 'retry'

type DesktopUpdateStatus =
  | 'idle'
  | 'unsupported'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'no-update'
  | 'installing'
  | 'error'

interface DesktopUpdateState {
  channel: string
  status: DesktopUpdateStatus
  currentVersion: string
  latestVersion: string | null
  message: string
  checkReason: DesktopUpdateReason
  progressPercent: number
  bytesPerSecond: number
  transferredBytes: number
  totalBytes: number
  retryAttempt: number
  retryMaxAttempts: number
  retryNextDelayMs: number | null
  lastCheckedAt: string | null
  lastError: string | null
  updatedAt: string | null
}

interface DesktopUpdatesApi {
  getState: () => Promise<DesktopUpdateState>
  checkNow: () => Promise<{ ok?: boolean; reason?: string; state?: DesktopUpdateState } | DesktopUpdateState>
  installNow: () => Promise<{ ok: boolean; reason?: string; state?: DesktopUpdateState }>
  onStateChange: (callback: (state: DesktopUpdateState) => void) => () => void
}

interface DesktopBridge {
  platform: string
  updateChannel: string
  updates?: DesktopUpdatesApi
}

interface Window {
  desktop?: DesktopBridge
}


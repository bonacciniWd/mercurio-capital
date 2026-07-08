import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CloudDownload, RefreshCw, X } from 'lucide-react'

const STATUS_LABEL: Record<DesktopUpdateStatus, string> = {
  idle: 'Aguardando',
  unsupported: 'Indisponível',
  checking: 'Verificando',
  available: 'Disponível',
  downloading: 'Baixando',
  downloaded: 'Pronto para instalar',
  'no-update': 'Atualizado',
  installing: 'Instalando',
  error: 'Falha',
}

const WIDGET_HIDDEN_STORAGE_KEY = 'mercurio:desktop_update_widget_hidden_v1'
const AUTO_REOPEN_STATUSES = new Set<DesktopUpdateStatus>(['downloaded', 'installing', 'error'])

function readWidgetHiddenPreference() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(WIDGET_HIDDEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistWidgetHiddenPreference(hidden: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (hidden) {
      window.localStorage.setItem(WIDGET_HIDDEN_STORAGE_KEY, '1')
      return
    }

    window.localStorage.removeItem(WIDGET_HIDDEN_STORAGE_KEY)
  } catch {
    // Ignora bloqueios de storage para nao quebrar fluxo de update.
  }
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let index = 0

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatRetryCountdown(delayMs: number | null) {
  if (!delayMs || delayMs <= 0) {
    return null
  }

  const seconds = Math.ceil(delayMs / 1000)
  return `${seconds}s`
}

export function DesktopUpdateWidget() {
  const desktopApi = typeof window !== 'undefined' ? window.desktop : undefined
  const updatesApi = desktopApi?.updates

  const [state, setState] = useState<DesktopUpdateState | null>(null)
  const [actionInFlight, setActionInFlight] = useState<'check' | 'install' | null>(null)
  const [isHidden, setIsHidden] = useState(readWidgetHiddenPreference)

  useEffect(() => {
    if (!updatesApi) {
      return
    }

    let mounted = true

    updatesApi
      .getState()
      .then((initial) => {
        if (mounted) {
          setState(initial)
        }
      })
      .catch(() => {
        if (mounted) {
          setState((current) =>
            current ?? {
              channel: 'stable',
              status: 'error',
              currentVersion: '0.0.0',
              latestVersion: null,
              message: 'Não foi possível carregar o estado de atualização.',
              checkReason: 'manual',
              progressPercent: 0,
              bytesPerSecond: 0,
              transferredBytes: 0,
              totalBytes: 0,
              retryAttempt: 0,
              retryMaxAttempts: 3,
              retryNextDelayMs: null,
              lastCheckedAt: null,
              lastError: 'Falha de comunicação com o processo desktop.',
              updatedAt: new Date().toISOString(),
            },
          )
        }
      })

    const unsubscribe = updatesApi.onStateChange((next) => {
      if (mounted) {
        setState(next)
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [updatesApi])

  useEffect(() => {
    if (!state) {
      return
    }

    if (isHidden && AUTO_REOPEN_STATUSES.has(state.status)) {
      setIsHidden(false)
      persistWidgetHiddenPreference(false)
    }
  }, [isHidden, state])

  const canCheck = useMemo(() => {
    if (!state) {
      return false
    }

    return state.status !== 'checking' && state.status !== 'downloading' && actionInFlight !== 'check'
  }, [actionInFlight, state])

  const canInstall = !!state && state.status === 'downloaded' && actionInFlight !== 'install'

  async function handleCheckNow() {
    if (!updatesApi) {
      return
    }

    if (!canCheck) {
      return
    }

    setActionInFlight('check')
    try {
      await updatesApi.checkNow()
    } finally {
      setActionInFlight(null)
    }
  }

  async function handleInstallNow() {
    if (!updatesApi) {
      return
    }

    if (!canInstall) {
      return
    }

    setActionInFlight('install')
    try {
      await updatesApi.installNow()
    } finally {
      setActionInFlight(null)
    }
  }

  function handleHideWidget() {
    setIsHidden(true)
    persistWidgetHiddenPreference(true)
  }

  function handleShowWidget() {
    setIsHidden(false)
    persistWidgetHiddenPreference(false)
  }

  if (!updatesApi || !state) {
    return null
  }

  if (isHidden) {
    return (
      <button
        type="button"
        onClick={handleShowWidget}
        aria-label="Mostrar widget de atualização"
        className="fixed bottom-4 right-4 z-[80] inline-flex items-center gap-2 rounded-full border border-silver-300 bg-white/95 px-3 py-2 text-xs font-semibold text-silver-700 shadow-lg backdrop-blur transition hover:bg-white"
      >
        <CloudDownload className="h-4 w-4 text-navy" />
        <span>Atualizações</span>
        <span className="rounded-full bg-silver-100 px-2 py-0.5 text-[10px] font-medium text-silver-600">
          {STATUS_LABEL[state.status]}
        </span>
      </button>
    )
  }

  const retryCountdown = formatRetryCountdown(state.retryNextDelayMs)
  const isDownloading = state.status === 'downloading'
  const progressPercent = Math.min(100, Math.max(0, state.progressPercent || 0))

  return (
    <aside className="fixed bottom-4 right-4 z-[80] w-[360px] rounded-xl border border-silver-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-silver-900">Atualização Desktop</p>
          <p className="text-[11px] uppercase tracking-wide text-silver-500">Canal {state.channel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-silver-100 px-2.5 py-1 text-[11px] font-medium text-silver-700">
            {STATUS_LABEL[state.status]}
          </span>
          <button
            type="button"
            onClick={handleHideWidget}
            aria-label="Ocultar widget de atualização"
            className="rounded-full border border-silver-300 p-1 text-silver-500 transition hover:bg-silver-100 hover:text-silver-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 text-xs">
        {state.status === 'error' ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        ) : state.status === 'downloaded' || state.status === 'no-update' || state.status === 'installing' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <CloudDownload className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
        )}
        <div className="space-y-1 text-silver-700">
          <p>{state.message}</p>
          {state.latestVersion && <p>Versão disponível: {state.latestVersion}</p>}
          <p>Versão atual: {state.currentVersion}</p>
          {retryCountdown && (
            <p className="text-amber-700">
              Retry automático em {retryCountdown} ({state.retryAttempt}/{state.retryMaxAttempts})
            </p>
          )}
          {state.lastError && state.status === 'error' && <p className="text-red-600">Detalhe: {state.lastError}</p>}
        </div>
      </div>

      {isDownloading && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-silver-200">
            <div
              className="h-full rounded-full bg-navy transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-silver-500">
            {progressPercent.toFixed(1)}% · {formatBytes(state.transferredBytes)} / {formatBytes(state.totalBytes)} ·{' '}
            {formatBytes(state.bytesPerSecond)}/s
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCheckNow}
          disabled={!canCheck}
          className="inline-flex items-center gap-1 rounded-md border border-silver-300 px-3 py-1.5 text-xs font-medium text-silver-700 transition hover:bg-silver-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${actionInFlight === 'check' ? 'animate-spin' : ''}`} />
          Verificar agora
        </button>

        {state.status === 'downloaded' && (
          <button
            type="button"
            onClick={handleInstallNow}
            disabled={!canInstall}
            className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Instalar e reiniciar
          </button>
        )}
      </div>
    </aside>
  )
}

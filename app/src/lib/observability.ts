import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'
const ENV = (import.meta.env.MODE as string | undefined) ?? 'development'

let initialized = false

export function initObservability() {
  if (initialized) return
  initialized = true

  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENV,
      tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: ENV === 'production' ? 0.1 : 0,
    })
  } else if (ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.info('[observability] Sentry desativado (VITE_SENTRY_DSN ausente).')
  }

  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      persistence: 'localStorage',
      autocapture: true,
    })
  } else if (ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.info('[observability] PostHog desativado (VITE_POSTHOG_KEY ausente).')
  }
}

export { Sentry, posthog }

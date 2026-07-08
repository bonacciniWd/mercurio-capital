import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { router } from './router'
import { AuthProvider } from '@/auth/AuthContext'
import { queryClient } from '@/lib/queryClient'
import { initObservability, Sentry } from '@/lib/observability'
import { DesktopUpdateWidget } from '@/components/DesktopUpdateWidget'
import './index.css'

const initialDesktopPath = new URLSearchParams(window.location.search).get('initialPath')
if (
  window.location.protocol === 'file:' &&
  initialDesktopPath &&
  window.location.pathname.endsWith('/index.html')
) {
  window.history.replaceState(null, '', initialDesktopPath)
}

initObservability()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{ padding: 24 }}>Algo deu errado. Recarregue a página.</div>}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <DesktopUpdateWidget />
        </AuthProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

function resolveLoginPath(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/admin/login'
  if (pathname.startsWith('/c')) return '/c/login'
  if (pathname.startsWith('/p')) return '/p/login'
  return '/login'
}

export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-silver-500">
        Carregando sessão…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={resolveLoginPath(location.pathname)} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

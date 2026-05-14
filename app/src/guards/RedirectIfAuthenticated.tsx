import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export function RedirectIfAuthenticated() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-silver-500">
        Carregando sessão…
      </div>
    )
  }

  if (!session) {
    return <Outlet />
  }

  if (session.role === 'partner' && !session.approved) {
    return <Navigate to="/acesso-pendente" replace />
  }

  if (session.requiresTwoFactor && !session.twoFactorEnrolled) {
    return <Navigate to="/2fa/setup" replace />
  }

  if (session.requiresTwoFactor && !session.twoFactorVerified) {
    return <Navigate to="/2fa" replace />
  }

  if (session.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (session.role === 'client') {
    return <Navigate to="/c" replace />
  }

  return <Navigate to="/p" replace />
}

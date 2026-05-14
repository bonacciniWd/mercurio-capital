import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export function Require2FA() {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (session.requiresTwoFactor && !session.twoFactorEnrolled) {
    return <Navigate to="/2fa/setup" replace />
  }

  if (session.requiresTwoFactor && !session.twoFactorVerified) {
    return <Navigate to="/2fa" replace />
  }

  return <Outlet />
}

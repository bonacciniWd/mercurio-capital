import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import type { AppRole } from '@/auth/types'

export function RequireRole({ roles }: { roles: AppRole[] }) {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!roles.includes(session.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}


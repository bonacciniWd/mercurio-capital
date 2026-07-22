import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { isLimitedAdmin, isLimitedAdminPathAllowed } from '@/lib/adminScope'

// Restringe o admin limitado às telas do seu escopo. Admin full passa direto.
export function RequireAdminScope() {
  const { session } = useAuth()
  const location = useLocation()

  if (isLimitedAdmin(session) && !isLimitedAdminPathAllowed(location.pathname)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}

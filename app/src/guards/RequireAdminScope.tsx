import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { isRestrictedAdmin, isRestrictedAdminPathAllowed } from '@/lib/adminScope'

// Restringe admin de escopo reduzido (limitado/juridico) às telas permitidas.
export function RequireAdminScope() {
  const { session } = useAuth()
  const location = useLocation()

  if (isRestrictedAdmin(session) && !isRestrictedAdminPathAllowed(location.pathname)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}

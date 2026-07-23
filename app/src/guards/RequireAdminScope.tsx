import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { adminNivelOf, isAdminPathAllowed } from '@/lib/adminScope'

// Restringe admin de escopo reduzido (limitado/juridico) às telas permitidas por nível.
export function RequireAdminScope() {
  const { session } = useAuth()
  const location = useLocation()
  const nivel = adminNivelOf(session)

  if (nivel && nivel !== 'full' && !isAdminPathAllowed(location.pathname, nivel)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}

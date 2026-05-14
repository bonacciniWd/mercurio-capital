import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export function RequireApproved() {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (session.role === 'partner' && !session.approved) {
    return <Navigate to="/acesso-pendente" replace />
  }

  return <Outlet />
}


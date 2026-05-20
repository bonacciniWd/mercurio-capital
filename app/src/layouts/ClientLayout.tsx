import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/auth/AuthContext'
import { NotificationBell } from '@/components/NotificationBell'

export function ClientLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/c/login', { replace: true })
  }

  return (
    <div className="min-h-screen py-6 bg-silver-50">
      <a href="#client-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-navy focus:px-3 focus:py-2 focus:text-sm focus:text-white">
        Pular para o conteúdo
      </a>
      <header className="border-b border-silver-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/c"><Logo /></Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/c" end className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy' : 'text-silver-600 hover:text-navy'}`}>Início</NavLink>
            <NavLink to="/c/documentos" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy' : 'text-silver-600 hover:text-navy'}`}>Documentos</NavLink>
            <NavLink to="/c/universidade" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy' : 'text-silver-600 hover:text-navy'}`}>Universidade</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-silver-500">{session?.nome ?? 'Cliente'}</span>
            <button className="btn-outline text-xs" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8" id="client-main" aria-label="Conteúdo principal">
        <Outlet />
      </main>
    </div>
  )
}

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Bell } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'

export function ClientLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/c/login', { replace: true })
  }

  return (
    <div className="min-h-screen py-6 bg-silver-50">
      <header className="border-b border-silver-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/c"><Logo /></Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/c" end className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy' : 'text-silver-600 hover:text-navy'}`}>Início</NavLink>
            <NavLink to="/c/documentos" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy' : 'text-silver-600 hover:text-navy'}`}>Documentos</NavLink>
            <NavLink to="/c/universidade" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy' : 'text-silver-600 hover:text-navy'}`}>Universidade</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full p-2 hover:bg-silver-100">
              <Bell className="h-5 w-5 text-silver-600" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
            </button>
            <span className="text-xs text-silver-500">{session?.nome ?? 'Cliente'}</span>
            <button className="btn-outline text-xs" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

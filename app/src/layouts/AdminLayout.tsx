import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import {
  LayoutDashboard, UserCheck, Network, Kanban, FileText, Folder, Wallet, Coins,
  BarChart3, GraduationCap, Settings, Loader2, Trophy, UserRoundPlus,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { NotificationBell } from '@/components/NotificationBell'
import { isRestrictedAdmin, isRestrictedAdminNavPath } from '@/lib/adminScope'

const ITEMS = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/aprovacoes', icon: UserCheck, label: 'Aprovações' },
  { to: '/admin/parceiros', icon: Folder, label: 'Parceiros' },
  { to: '/admin/rede', icon: Network, label: 'Rede' },
  { to: '/admin/kanban', icon: Kanban, label: 'Kanban' },
  { to: '/admin/propostas', icon: FileText, label: 'Propostas' },
  { to: '/admin/leads/simulacoes', icon: UserRoundPlus, label: 'Leads' },
  // Carteiras permanece como atalho operacional; os demais módulos financeiros ficam agrupados.
  { to: '/admin/financeiro/carteiras', icon: Wallet, label: 'Carteiras' },
  { to: '/admin/financeiro', icon: Coins, label: 'Financeiro', end: true },
  { to: '/admin/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/admin/universidade', icon: GraduationCap, label: 'Universidade' },
  { to: '/admin/milestones', icon: Trophy, label: 'Milestones' },
  { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
]

const logoSquare = new URL('../assets/logos/logo-square.png', import.meta.url).href

export function AdminLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [])

  const items = isRestrictedAdmin(session)
    ? ITEMS.filter((it) => isRestrictedAdminNavPath(it.to))
    : ITEMS

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex h-dvh min-h-0 min-w-0 overflow-hidden bg-silver-50">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-navy focus:px-3 focus:py-2 focus:text-sm focus:text-white">
        Pular para o conteúdo
      </a>
      <aside className="flex h-dvh min-h-0 w-64 shrink-0 flex-col overflow-hidden text-white" style={{
        background: 'linear-gradient(180deg, #0c0f14 0%, #10141b 55%, #13181f 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '4px 0 28px rgba(0,0,0,0.55)',
      }}>
        {/* Logo */}
        <div className="flex h-auto items-center px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <img src={logoSquare} alt="Mercurio Capital" className="h-full w-auto" />
        </div>
        {/* Navegação */}
        <nav className="scrollbar-dark min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive ? 'text-red-400' : 'text-white/45 hover:text-white/85'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(90deg, rgba(217,83,79,0.16) 0%, rgba(217,83,79,0.04) 100%)',
                borderLeft: '2px solid #f87171',
                paddingLeft: '10px',
              } : {
                borderLeft: '2px solid transparent',
              }}
            >
              <it.icon className="h-4 w-4 shrink-0" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 text-[12px] " style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          Admin · v0.1
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" id="admin-main" aria-label="Conteúdo principal">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-silver-200 bg-white px-6">
          <p className="text-sm font-medium text-silver-700">Administração</p>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-silver-500">{session?.nome ?? 'Admin'}</span>
            <button className="btn-outline text-xs" onClick={handleLogout}>Sair</button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <Suspense fallback={
            <div className="flex h-64 items-center justify-center text-silver-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import {
  LayoutDashboard, UserCheck, Network, Kanban, FileText, Folder, DollarSign,
  BarChart3, GraduationCap, Workflow, Megaphone, Plug, Settings, ScrollText, Bell,
} from 'lucide-react'

const ITEMS = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/aprovacoes', icon: UserCheck, label: 'Aprovações' },
  { to: '/admin/parceiros', icon: Folder, label: 'Parceiros' },
  { to: '/admin/rede', icon: Network, label: 'Rede' },
  { to: '/admin/kanban', icon: Kanban, label: 'Kanban' },
  { to: '/admin/propostas', icon: FileText, label: 'Propostas' },
  { to: '/admin/financeiro/carteiras', icon: DollarSign, label: 'Financeiro' },
  { to: '/admin/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/admin/universidade', icon: GraduationCap, label: 'Universidade' },
  { to: '/admin/fluxos', icon: Workflow, label: 'Fluxos' },
  { to: '/admin/campanhas', icon: Megaphone, label: 'Campanhas' },
  { to: '/admin/integracoes', icon: Plug, label: 'Integrações' },
  { to: '/admin/auditoria', icon: ScrollText, label: 'Auditoria' },
  { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
]

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-silver-50">
      <aside className="flex w-60 shrink-0 flex-col bg-[#0b1220] text-white">
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Logo variant="light" />
          <span className="badge bg-danger/20 text-danger">Admin</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-danger/20 text-danger border-l-2 border-danger' : 'text-white/75 hover:bg-white/5'
                }`
              }
            >
              <it.icon className="h-4 w-4" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-white/40">Admin · v0.1</div>
      </aside>
      <main className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-silver-200 bg-white px-6">
          <p className="text-sm font-medium text-silver-700">Administração</p>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full p-2 hover:bg-silver-100">
              <Bell className="h-5 w-5 text-silver-600" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-danger text-white text-sm font-semibold">
              AD
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

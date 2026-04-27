import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { brl } from '@/lib/utils'
import {
  LayoutDashboard, Calculator, FileText, Users, Wallet, BarChart3,
  GraduationCap, Settings, Bell, ChevronRight,
} from 'lucide-react'

const ITEMS = [
  { to: '/p', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/p/simulacoes', icon: Calculator, label: 'Simulações' },
  { to: '/p/propostas', icon: FileText, label: 'Propostas' },
  { to: '/p/equipe', icon: Users, label: 'Equipe' },
  { to: '/p/carteira', icon: Wallet, label: 'Carteira' },
  { to: '/p/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/p/universidade', icon: GraduationCap, label: 'Universidade' },
  { to: '/p/configuracoes', icon: Settings, label: 'Configurações' },
]

export function PartnerLayout() {
  const saldo = 125000 // centavos = R$ 1.250,00
  return (
    <div className="flex min-h-screen bg-silver-50">
      <aside className="flex w-60 shrink-0 flex-col bg-navy text-white">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Logo variant="light" />
        </div>
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-navy font-bold">
              C
            </div>
            <div>
              <p className="text-sm font-semibold">Construtora Aurora</p>
              <span className="badge bg-success/20 text-success mt-0.5">Parceiro</span>
            </div>
          </div>
        </div>
        <div className="m-4 rounded-lg bg-gold p-4 text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide">Saldo</p>
          <p className="mt-1 text-xl font-bold">{brl(saldo)}</p>
          <NavLink to="/p/carteira/recarga" className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-gold hover:bg-navy-600">
            Recarregar →
          </NavLink>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-gold' : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <it.icon className="h-4 w-4" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-xs text-white/40">v0.1 · Mercurio Capital</div>
      </aside>
      <main className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-silver-200 bg-white px-6">
          <div className="flex items-center gap-2 text-sm text-silver-500">
            <span>Parceiro</span>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-silver-900">Painel</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full p-2 hover:bg-silver-100">
              <Bell className="h-5 w-5 text-silver-600" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white text-sm font-semibold">
              JR
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

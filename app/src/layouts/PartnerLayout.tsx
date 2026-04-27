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
      <aside className="flex w-64 shrink-0 flex-col text-white" style={{
        background: 'linear-gradient(180deg, #07101e 0%, #0a1628 50%, #0d1c32 100%)',
        borderRight: '1px solid rgba(255,255,255,0.055)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.45)',
      }}>
        {/* Logo */}
        <div className="flex h-16 items-center px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Logo variant="light" />
        </div>

        {/* Perfil */}
        <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-navy text-sm font-bold shadow-md">
              C
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Construtora Aurora</p>
              <span className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: 'rgba(44,154,76,0.18)', color: '#4ade80', border: '1px solid rgba(44,154,76,0.25)' }}>
                Parceiro
              </span>
            </div>
          </div>
        </div>

        {/* Card de saldo */}
        <div className="mx-4 my-4 rounded-xl p-4" style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.08) 100%)',
          border: '1px solid rgba(212,175,55,0.25)',
        }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold/60">Saldo disponível</p>
          <p className="mt-1 text-2xl font-bold text-gold">{brl(saldo)}</p>
          <NavLink
            to="/p/carteira/recarga"
            className="btn-no-liquid mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.15)')}
          >
            Recarregar →
          </NavLink>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-0.5 px-3">
          {ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'text-gold'
                    : 'text-white/50 hover:text-white/90'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(90deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.04) 100%)',
                borderLeft: '2px solid #D4AF37',
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

        <div className="p-4 text-[11px] text-white/20" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          v0.1 · Mercurio Capital
        </div>
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

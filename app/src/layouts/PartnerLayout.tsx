import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { ElectricBannerCard } from '@/components/ElectricBannerCard'
import {
  LayoutDashboard, Calculator, FileText, Users, Wallet, BarChart3, Coins,
  GraduationCap, Settings, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { NotificationBell } from '@/components/NotificationBell'

const logoSquare = new URL('../assets/logos/logo-square.png', import.meta.url).href

// Banner images — will be configurable via admin/configurações → Domínio e Marca / Promoções
const BANNER_SRCS = [
  
  new URL('../assets/promotions/promo.jpeg', import.meta.url).href,
  new URL('../assets/promotions/promo2.jpeg', import.meta.url).href,
  new URL('../assets/promotions/promo3.jpeg', import.meta.url).href,
]

const ITEMS = [
  { to: '/p', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/p/simulacoes', icon: Calculator, label: 'Simulações' },
  { to: '/p/propostas', icon: FileText, label: 'Propostas' },
  { to: '/p/equipe', icon: Users, label: 'Equipe' },
  { to: '/p/carteira', icon: Wallet, label: 'Carteira' },
  { to: '/p/comissoes', icon: Coins, label: 'Comissões' },
  { to: '/p/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/p/universidade', icon: GraduationCap, label: 'Universidade' },
  { to: '/p/configuracoes', icon: Settings, label: 'Configurações' },
]

export function PartnerLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/p/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-silver-50">
      <a href="#partner-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-navy focus:px-3 focus:py-2 focus:text-sm focus:text-white">
        Pular para o conteúdo
      </a>
      <aside className="relative flex h-screen w-64 shrink-0 flex-col overflow-hidden text-white" style={{
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

      
        

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto space-y-0.5 px-3 py-1">
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

        {/* Banner promocional com slideshow */}
        <div className="shrink-0 min-h-64 px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <ElectricBannerCard srcs={BANNER_SRCS} to="/p/milestones" />
        </div>
  
        <div className="p-4 text-[11px] text-white/20" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          v0.1 · Mercurio Capital
        </div>
      </aside>
      <main className="flex flex-1 flex-col" id="partner-main" aria-label="Conteúdo principal">
        <header className="flex h-16 items-center justify-between border-b border-silver-200 bg-white px-6">
          <div className="flex items-center gap-2 text-sm text-silver-500">
            <span>Parceiro</span>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-silver-900">Painel</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-silver-500">{session?.nome ?? 'Parceiro'}</span>
            <button className="btn-outline text-xs" onClick={handleLogout}>Sair</button>
          </div>
        </header>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { ArrowRight, Building2, Search, Mail, LayoutDashboard, Shield } from 'lucide-react'

export function Landing() {
  return (
    <div className="min-h-screen bg-silver-50">
      <header className="border-b border-silver-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <Link to="/login" className="btn-gold">Acessar plataforma <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">Crédito imobiliário inteligente</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight">
            Plataforma completa para parceiros de <span className="text-gold">Crédito Imobiliário</span> no Brasil
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/80">
            Home Equity, Crédito Construção e Financiamento Imobiliário em um só lugar — da simulação ao registro do contrato.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/login" className="btn-gold">Quero ser parceiro</Link>
            <Link to="/protocolo" className="btn-outline border-white/40 bg-transparent text-white hover:bg-white/10">
              Consultar protocolo
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-2 text-2xl font-bold text-navy">Acesso rápido às telas (preview)</h2>
        <p className="mb-8 text-silver-600">Protótipo navegável das interfaces do sistema.</p>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <PreviewCard to="/login" icon={<Mail />} title="Público" desc="Login, registro, magic link e consulta por protocolo." color="navy" />
          <PreviewCard to="/c" icon={<Building2 />} title="Portal Cliente" desc="Acompanhamento de propostas e envio de documentos." color="silver" />
          <PreviewCard to="/p" icon={<LayoutDashboard />} title="Painel Parceiro" desc="Dashboard, wizard, propostas, carteira e equipe." color="gold" />
          <PreviewCard to="/admin" icon={<Shield />} title="Painel Admin" desc="Aprovações, rede, kanban, financeiro e auditoria." color="red" />
        </div>
      </section>

      <footer className="border-t border-silver-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-silver-500">
          © 2026 Mercurio Capital · Protótipo de interface
        </div>
      </footer>
    </div>
  )
}

function PreviewCard({ to, icon, title, desc, color }: { to: string; icon: React.ReactNode; title: string; desc: string; color: 'navy'|'silver'|'gold'|'red' }) {
  const tone = {
    navy: 'bg-navy text-white',
    silver: 'bg-silver-200 text-silver-900',
    gold: 'bg-gold text-navy',
    red: 'bg-danger text-white',
  }[color]
  return (
    <Link to={to} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md ${tone}`}>{icon}</div>
      <h3 className="font-semibold text-silver-900 group-hover:text-navy">{title}</h3>
      <p className="mt-1 text-sm text-silver-600">{desc}</p>
      <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold-600">Abrir <ArrowRight className="h-4 w-4" /></p>
    </Link>
  )
}

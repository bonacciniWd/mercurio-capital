import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Search,
  Download as DownloadIcon,
  ShieldCheck,
  Zap,
  TrendingUp,
  CheckCircle2,
  Building2,
  Mail,
  LayoutDashboard,
  Shield,
  Wallet,
  GraduationCap,
  FileSignature,
} from 'lucide-react'
import iconUrl from '@/assets/logos/mercurio-icon.png'
import logoWide from '@/assets/logos/logowide.png'
import callToBanner from '@/assets/call-to.png'

export function Landing() {
  const [params] = useSearchParams()
  const showPreview = params.get('preview') === '1'

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ============================== HEADER ============================== */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/">
            <img src={logoWide} alt="Mercurio Capital" className="h-16 w-auto" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-700 md:flex">
            <a href="#produtos" className="transition hover:text-red-600">Produtos</a>
            <a href="#plataforma" className="transition hover:text-red-600">Plataforma</a>
            <Link to="/protocolo" className="transition hover:text-red-600">Consulta</Link>
            <Link to="/download" className="transition hover:text-red-600">Download</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Entrar <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden bg-black text-white">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-red-600/30 blur-[120px]" />
          <div className="absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-red-800/20 blur-[140px]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center lg:py-32">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Crédito imobiliário
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Originação de crédito imobiliário <span className="text-red-500">sem fricção</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Home Equity, Crédito Construção e Financiamento — da simulação ao registro do contrato em uma única plataforma.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700"
              >
                Quero ser parceiro <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/download"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-white/10"
              >
                <DownloadIcon className="h-4 w-4" /> Baixar app desktop
              </Link>
              <Link
                to="/protocolo"
                className="inline-flex items-center gap-2 px-2 py-3 text-sm font-medium text-white/70 transition hover:text-white"
              >
                <Search className="h-4 w-4" /> Consultar protocolo
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
              <Stat value="R$ 1B+" label="Originado" />
              <Stat value="98%" label="Aprovação" />
              <Stat value="3 dias" label="Análise média" />
            </div>
          </div>

          {/* Visual lateral */}
          <div className="relative hidden lg:block">
            <div className="relative mx-auto h-[440px] w-full max-w-md">
              <div className="absolute right-0 top-0 w-72 rotate-3 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/20 text-red-500">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white/50">Home Equity</p>
                    <p className="text-sm font-semibold">R$ 850.000</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    APROVADO
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-[10px] uppercase text-white/40">LTV</p><p className="text-sm font-bold">41%</p></div>
                  <div><p className="text-[10px] uppercase text-white/40">Prazo</p><p className="text-sm font-bold">120m</p></div>
                  <div><p className="text-[10px] uppercase text-white/40">Taxa</p><p className="text-sm font-bold">1,39%</p></div>
                </div>
              </div>

              <div className="absolute left-0 top-32 w-80 -rotate-2 rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/80 to-black p-5 shadow-2xl shadow-red-900/40">
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Protocolo #MC-2026-A8</p>
                <p className="mt-2 text-lg font-bold">Contrato assinado</p>
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-white/70">Análise concluída em 2 dias</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-white/70">Assinado via Clicksign</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-white/70">Registro automático</span>
                </div>
              </div>

              <div className="absolute bottom-0 right-4 w-64 rotate-1 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/50">Carteira</p>
                  <Wallet className="h-3.5 w-3.5 text-red-500" />
                </div>
                <p className="mt-1 text-2xl font-bold">R$ 2.847,50</p>
                <p className="mt-1 text-[10px] text-emerald-400">+ R$ 500,00 nesta semana</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== PRODUTOS ============================== */}
      <section id="produtos" className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-6 text-base text-center font-bold uppercase tracking-widest text-red-600">Produtos</p>
        <img
          src={callToBanner}
          alt="Três linhas de crédito. Uma única esteira."
          className="w-full h-auto object-cover"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <ProductCard
            title="Home Equity"
            desc="Crédito com garantia de imóvel quitado. Taxas a partir de 1,19% a.m."
            tags={['LTV até 60%', 'Até 240 meses', 'Liberação rápida']}
          />
          <ProductCard
            title="Crédito Construção"
            desc="Financiamento para obra ou reforma, com liberação por etapas."
            highlight
            tags={['Liberação por medição', 'Carência', 'Engenharia inclusa']}
          />
          <ProductCard
            title="Financiamento Imobiliário"
            desc="Aquisição de imóvel residencial ou comercial pronto."
            tags={['Até 80% LTV', 'IPCA + juros', 'SAC ou Price']}
          />
        </div>
      </section>

      {/* ============================== PLATAFORMA ============================== */}
      <section id="plataforma" className="bg-zinc-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-500">Plataforma</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo o que você precisa para originar e fechar
            </h2>
            <p className="mt-4 text-white/60">
              Da consulta a bureaus à assinatura digital — sem trocar de sistema.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard Icon={Zap}           title="Wizard inteligente"   desc="Crie propostas em 7 passos. LTV, parcela e renda mínima em tempo real." />
            <FeatureCard Icon={ShieldCheck}   title="Bureaus integrados"   desc="Serasa, Bacen SCR, Jusbrasil, RI Digital — débito automático na carteira." />
            <FeatureCard Icon={FileSignature} title="Contrato e assinatura" desc="Geração de contrato + envio Clicksign + acompanhamento até o registro." />
            <FeatureCard Icon={TrendingUp}    title="Dashboards"            desc="KPIs, funil de conversão, evolução mensal e gargalos por etapa." />
            <FeatureCard Icon={Wallet}        title="Carteira do parceiro"  desc="Recargas via Stripe, extrato detalhado e comissões automatizadas." />
            <FeatureCard Icon={GraduationCap} title="Universidade Mercurio" desc="Trilhas de formação para parceiros com certificação ao concluir." />
          </div>
        </div>
      </section>

      {/* ============================== CTA DOWNLOAD ============================== */}
      <section className="relative overflow-hidden bg-black py-20 text-white">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-red-600/30 blur-[120px]" />
          <div className="absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-red-800/20 blur-[140px]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }} />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-200">App desktop</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Mais performance no seu computador
            </h2>
            <p className="mt-4 max-w-xl text-white/85">
              Versão nativa para Windows, macOS e Linux com notificações, modo offline parcial e atalhos do sistema.
            </p>
            <Link
              to="/download"
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700"
            >
              <DownloadIcon className="h-4 w-4" /> Ver versões disponíveis
            </Link>
          </div>
          <div className="relative">
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-3xl bg-white/10 ring-1 ring-white/20 backdrop-blur lg:h-56 lg:w-56">
              <img src={iconUrl} alt="" className="w-full h-full drop-shadow-2xl rounded-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================== PREVIEW (oculto em produção, ative com ?preview=1) ============================== */}
      {showPreview && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-2 text-2xl font-bold">Acesso rápido às telas (preview)</h2>
          <p className="mb-8 text-zinc-600">Protótipo navegável das interfaces do sistema.</p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <PreviewCard to="/login" Icon={Mail}            title="Público"         desc="Login, registro, magic link e consulta por protocolo." />
            <PreviewCard to="/c"     Icon={Building2}       title="Portal Cliente"  desc="Acompanhamento de propostas e envio de documentos." />
            <PreviewCard to="/p"     Icon={LayoutDashboard} title="Painel Parceiro" desc="Dashboard, wizard, propostas, carteira e equipe." />
            <PreviewCard to="/admin" Icon={Shield}          title="Painel Admin"    desc="Aprovações, rede, kanban, financeiro e auditoria." />
          </div>
        </section>
      )}

      {/* ============================== FOOTER ============================== */}
      <footer className="relative overflow-hidden border-t border-white/10 bg-black/40 text-black">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-[300px] w-[300px] rounded-full bg-red-600/20 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }} />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-600 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src={logoWide} alt="Mercurio Capital" className="h-12 w-auto" />
            <span className="text-black">© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/protocolo" className="transition hover:text-zinc-900">Consulta pública</Link>
            <Link to="/download" className="transition hover:text-zinc-900">Download</Link>
            <Link to="/login" className="transition hover:text-zinc-900">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ---------- Subcomponentes ---------- */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-white sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-white/50">{label}</p>
    </div>
  )
}

function ProductCard({ title, desc, tags, highlight = false }: { title: string; desc: string; tags: string[]; highlight?: boolean }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${
      highlight ? 'border-red-200 bg-gradient-to-br from-red-50 to-white' : 'border-zinc-200 bg-white'
    }`}>
      {highlight && (
        <span className="absolute right-4 top-4 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
          Em destaque
        </span>
      )}
      <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600">{desc}</p>
      <ul className="mt-5 space-y-2">
        {tags.map(t => (
          <li key={t} className="flex items-center gap-2 text-sm text-zinc-700">
            <CheckCircle2 className="h-4 w-4 text-red-600" /> {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FeatureCard({ Icon, title, desc }: { Icon: typeof Zap; title: string; desc: string }) {
  return (
    <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-red-500/40 hover:bg-white/[0.06]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/15 text-red-500 ring-1 ring-red-500/20">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-white/60">{desc}</p>
    </div>
  )
}

function PreviewCard({ to, Icon, title, desc }: { to: string; Icon: typeof Mail; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-red-600">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{desc}</p>
      <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-600">
        Abrir <ArrowRight className="h-4 w-4" />
      </p>
    </Link>
  )
}

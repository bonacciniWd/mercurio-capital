import { useLayoutEffect, useRef } from 'react'
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
import { motion, useReducedMotion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import iconUrl from '@/assets/logos/mercurio-icon.png'
import logoWide from '@/assets/logos/logowide.png'
import logoDark from '@/assets/logos/logo-dark.png'
import callToBanner from '@/assets/call-to.png'

gsap.registerPlugin(ScrollTrigger)

export function Landing() {
  const [params] = useSearchParams()
  const showPreview = params.get('preview') === '1'
  const shouldReduceMotion = useReducedMotion()
  const plataformaSectionRef = useRef<HTMLElement | null>(null)
  const plataformaHeaderRef = useRef<HTMLDivElement | null>(null)
  const plataformaCardsRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const section = plataformaSectionRef.current
    const header = plataformaHeaderRef.current
    const cardsContainer = plataformaCardsRef.current

    if (!section || !header || !cardsContainer) {
      return
    }

    const cards = Array.from(cardsContainer.querySelectorAll<HTMLElement>('[data-feature-card]'))

    if (!cards.length) {
      return
    }

    const mm = gsap.matchMedia()
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set([header, ...cards], { autoAlpha: 0, y: 24 })

        const timeline = gsap.timeline({
          defaults: { ease: 'power3.out' },
          scrollTrigger: {
            trigger: section,
            start: 'top 72%',
            once: true,
          },
        })

        timeline
          .to(header, {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
          })
          .to(
            cards,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.6,
              stagger: 0.1,
            },
            '-=0.35',
          )
      })

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set([header, ...cards], { autoAlpha: 1, y: 0 })
      })
    }, section)

    return () => {
      mm.revert()
      ctx.revert()
    }
  }, [])

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ============================== HEADER ============================== */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link to="/">
            <img src={logoWide} alt="Mercurio Capital" className="h-20 w-auto" />
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
      <section className="relative overflow-hidden min-h-[100vh] lg:min-h-[90vh] bg-black text-white">
        <AtmosphereBackground />

        <div className="relative mx-auto grid max-w-6xl gap-14 lg:mt-10 px-6 py-20 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:items-center lg:gap-16 lg:py-28 xl:gap-20 xl:py-32">
          <div className="mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-xl xl:max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Crédito imobiliário
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.03] tracking-tight sm:text-6xl lg:text-[3.5rem] xl:text-[4.1rem]">
              Originação de crédito imobiliário <span className="text-red-500">sem fricção</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70 xl:max-w-xl xl:text-[1.15rem]">
              Home Equity, Crédito Construção e Financiamento — da simulação ao registro do contrato em uma única plataforma.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3 lg:max-w-xl">
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

            <div className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-white/40 pt-8 xl:max-w-2xl">
              <Stat value="R$ 1B+" label="Originado" />
              <Stat value="98%" label="Aprovação" />
              <Stat value="3 dias" label="Análise média" />
            </div>
          </div>

          {/* Visual lateral */}
          <div className="relative hidden lg:block lg:pl-6 xl:pl-10">
            <div className="relative mx-auto h-[470px] w-full max-w-md xl:h-[500px] xl:max-w-lg">
              <motion.div
                className="absolute right-0 top-0 w-72 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl will-change-transform xl:w-80"
                animate={shouldReduceMotion ? { y: 0, rotate: 3, scale: 1.05 } : { y: [0, -10, 0], rotate: 3, scale: 1.05 }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : {
                        duration: 7.4,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                        delay: 0.15,
                      }
                }
              >
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
                  <div><p className="text-[10px] uppercase text-white/40">Taxa</p><p className="text-sm font-bold">1,29%</p></div>
                </div>
              </motion.div>

              <motion.div
                className="absolute left-0 top-32 w-80 rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/80 to-black p-5 shadow-2xl shadow-red-900/40 will-change-transform xl:top-36 xl:w-[23rem]"
                animate={shouldReduceMotion ? { y: 0, rotate: -2, scale: 1.05 } : { y: [0, -14, 0], rotate: -2, scale: 1.05 }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : {
                        duration: 8.2,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                        delay: 0.45,
                      }
                }
              >
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
              </motion.div>

              <motion.div
                className="absolute bottom-0 right-4 w-64 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-4 shadow-2xl will-change-transform xl:right-0 xl:w-72"
                animate={shouldReduceMotion ? { y: 0, rotate: 1, scale: 1.05 } : { y: [0, -8, 0], rotate: 1, scale: 1.05 }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : {
                        duration: 6.6,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                        delay: 0.25,
                      }
                }
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/50">Carteira</p>
                  <Wallet className="h-3.5 w-3.5 text-red-500" />
                </div>
                <p className="mt-1 text-2xl font-bold">R$ 2.847,50</p>
                <p className="mt-1 text-[10px] text-emerald-400">+ R$ 500,00 nesta semana</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== PRODUTOS ============================== */}
      <section id="produtos" className="mx-auto max-w-6xl px-6 py-20">
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
      <section ref={plataformaSectionRef} id="plataforma" className="relative min-h-screen overflow-hidden bg-black py-20 text-white">
        <AtmosphereBackground />

        <div className="relative mx-auto min-h-screen max-w-6xl px-6">
          <div ref={plataformaHeaderRef} className="mx-auto max-w-2xl text-center">
            <p className="text-xs py-6 font-semibold uppercase tracking-widest text-red-500">Plataforma</p>
            <h2 className="mt-3 py-6 text-3xl font-bold tracking-tight sm:text-3xl">
              Tudo o que você precisa para originar e fechar
            </h2>
            <p className="mt-4 text-white/60">
              Da consulta a bureaus à assinatura digital — sem trocar de sistema.
            </p>
            <div className="mx-auto mt-6 h-px w-32 bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
          </div>

          <div ref={plataformaCardsRef} className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      <section className="relative overflow-hidden min-h-screen lg:min-h-[80vh] bg-black py-20 text-white">
        <AtmosphereBackground />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs py-10 font-semibold uppercase tracking-widest text-red-600">App desktop</p>
            <h2 className="mt-3 py-6 text-4xl font-bold leading-tight sm:text-5xl">
              Mais performance no seu computador
            </h2>
            <p className="mt-4 max-w-xl text-white/85">
              Versão nativa para Windows, macOS e Linux com notificações, modo offline parcial e atalhos do sistema.
            </p>
            <Link
              to="/download"
              className="mt-48 inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700"
            >
              <DownloadIcon className="h-4 w-4" /> Ver versões disponíveis
            </Link>
          </div>
          <div className="relative">
            <DesktopAppMetalCard imageSrc={iconUrl} />
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
      <footer className="relative overflow-hidden border-t border-white/10 bg-black text-white">
        <AtmosphereBackground variant="footer" />

        <div className="relative mx-auto max-w-6xl px-6 py-10 text-sm">
          <div className="flex flex-col gap-7 lg:gap-8">
            <div className="flex flex-col items-center justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row">
              <div className="flex items-center gap-2.5">
                <img src={logoDark} alt="Mercurio Capital" className="h-16 w-auto" />
                <span className="text-white">© 2026</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-end">
                <Link to="/protocolo" className="transition hover:text-red-600">Consulta pública</Link>
                <Link to="/download" className="transition hover:text-red-600">Download</Link>
                <Link to="/login" className="transition hover:text-red-600">Entrar</Link>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2 text-xs text-white/70 sm:text-sm">
                <p>
                  <span className="font-semibold text-white">CNPJ:</span> 57.051.836/0001-32
                </p>
                <p>
                  <span className="font-semibold text-white">Endereço:</span> Rua 1301, 471 - Centro, Balneário Camboriú - SC, 88330-795.
                </p>
              </div>

              <div className="flex w-full justify-end lg:w-auto">
                <a
                  href="https://visionerifatta.space"
                  target="_blank"
                  rel="noreferrer"
                  className="footer__credits"
                  aria-label="Acessar site da Visione Rifatta"
                >
                  <small className="brand-credit">Powered by Visione Rifatta</small>
                  <span className="build-version" aria-label="Build version">v0.1.1</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ---------- Subcomponentes ---------- */

function AtmosphereBackground({ variant = 'default' }: { variant?: 'default' | 'footer' }) {
  const isFooter = variant === 'footer'

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {isFooter ? (
        <div className="absolute -top-24 -left-24 h-[300px] w-[300px] rounded-full bg-red-600/20 blur-[100px]" />
      ) : (
        <>
          <div className="absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-red-600/30 blur-[120px]" />
          <div className="absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-red-800/20 blur-[140px]" />
        </>
      )}
      <div
        className={`absolute inset-0 ${isFooter ? 'opacity-[0.03]' : 'opacity-[0.04]'}`}
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  )
}

function DesktopAppMetalCard({ imageSrc }: { imageSrc: string }) {
  return (
    <div className="mx-auto [perspective:1400px]">
      <motion.div
        initial="rest"
        animate="rest"
        whileHover="hover"
        variants={{
          rest: { rotateX: 0, rotateY: 0, y: 0, scale: 1 },
          hover: { rotateX: -10, rotateY: 12, y: -6, scale: 1.03 },
        }}
        transition={{ type: 'spring', stiffness: 230, damping: 18, mass: 0.8 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="group relative h-64 w-64 overflow-hidden rounded-[2rem] bg-zinc-950 p-[2px] shadow-[0_20px_60px_-28px_rgba(255,255,255,0.55),0_30px_70px_-30px_rgba(239,68,68,0.45)] lg:h-96 lg:w-96"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(148deg,#fafafa_0%,#c4c4c9_16%,#71717a_40%,#18181b_68%,#f5f5f5_100%)]" />
        <div className="pointer-events-none absolute inset-[2px] rounded-[30px] bg-zinc-950" />

        <motion.div
          className="pointer-events-none absolute inset-y-[8%] -left-1/2 w-1/2 skew-x-[-18deg] rounded-full bg-gradient-to-r from-transparent via-white/35 to-transparent blur-[1px]"
          variants={{
            rest: { x: '-160%', opacity: 0 },
            hover: { x: '260%', opacity: 1 },
          }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        <div className="pointer-events-none absolute inset-[2px] rounded-[30px] bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.24),transparent_35%),radial-gradient(circle_at_84%_88%,rgba(239,68,68,0.20),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-white/30" />

        <div className="relative h-full w-full overflow-hidden rounded-[30px] bg-zinc-950">
          <div className="absolute inset-[8px] rounded-[22px] border border-white/20 bg-gradient-to-br from-zinc-200/15 via-zinc-900/70 to-black shadow-inner" />
          <div className="absolute inset-[8px] rounded-[22px] bg-[linear-gradient(165deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.06)_42%,rgba(255,255,255,0)_72%)]" />
          <motion.img
            src={imageSrc}
            alt="Aplicativo Mercurio Capital"
            className="relative h-full w-full rounded-[22px] object-cover p-[8px] drop-shadow-[0_18px_26px_rgba(0,0,0,0.55)]"
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.04 },
            }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </motion.div>
    </div>
  )
}

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
    <div
      data-feature-card
      className="group relative py-12 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.18] to-white/[0.02] p-5 transition duration-300 hover:-translate-y-1 hover:border-red-500/45 hover:shadow-xl hover:shadow-red-900/20"
    >
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-red-500/10 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex mb-12 h-16 w-16 items-center justify-center rounded-lg">
        <Icon className="h-12 text-red-600 w-12" />
      </div>
      <h2 className="relative text-xl mt-4 font-semibold text-white">{title}</h2>
      <p className="relative mt-1.5 text-base text-white/65">{desc}</p>
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

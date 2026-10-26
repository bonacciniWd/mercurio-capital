import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
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
import logoWide from '@/assets/logos/logowide.png'
import logoWhite from '@/assets/logos/logo-white.png'
import logoRed from '@/assets/logos/logo.svg'
import executivePhoto from '@/assets/product.jpg'
import logoDark from '@/assets/logos/logo-dark.png'
import wizardCover from '@/assets/products/wizard.jpg'
import bureausCover from '@/assets/products/bureaus.jpg'
import contractCover from '@/assets/products/contrato.jpg'
import dashboardCover from '@/assets/products/dashboard.jpg'
import walletCover from '@/assets/products/wallet.jpg'
import universityCover from '@/assets/products/universidade.jpg'
import { PublicSimulator } from '@/components/PublicSimulator'
import { LandingConstructionSection } from '@/components/LandingConstructionSection'

gsap.registerPlugin(ScrollTrigger)

const landingProducts = [
  {
    number: '01',
    title: 'Home Equity',
    description: 'Crédito com garantia de imóvel quitado.',
    features: ['LTV até 60%', 'Até 240 meses', 'Liberação rápida'],
  },
  {
    number: '02',
    title: 'Crédito Construção',
    description: 'Financiamento para obra ou reforma, liberado por etapas.',
    features: ['Liberação por medição', 'Carência inteligente', 'Engenharia inclusa'],
    featured: true,
  },
  {
    number: '03',
    title: 'Financiamento Imobiliário',
    description: 'Aquisição de imóvel residencial ou comercial pronto.',
    features: ['Até 80% LTV', 'IPCA + juros', 'SAC ou Price'],
  },
]

const platformSlides = [
  {
    eyebrow: 'Originação',
    title: 'Wizard inteligente',
    description: 'Crie propostas em 7 passos. LTV, parcela e renda mínima em tempo real.',
    image: wizardCover,
    alt: 'Analista estruturando uma proposta de crédito com documentos e planta imobiliária',
    Icon: Zap,
  },
  {
    eyebrow: 'Inteligência',
    title: 'Bureaus integrados',
    description: 'Serasa, Bacen SCR, Jusbrasil, RI Digital — débito automático na carteira.',
    image: bureausCover,
    alt: 'Analista avaliando informações financeiras e indicadores em um painel',
    Icon: ShieldCheck,
  },
  {
    eyebrow: 'Formalização',
    title: 'Contrato e assinatura',
    description: 'Geração de contrato + envio Clicksign + acompanhamento até o registro.',
    image: contractCover,
    alt: 'Cliente assinando documentos de crédito em um tablet',
    Icon: FileSignature,
  },
  {
    eyebrow: 'Performance',
    title: 'Dashboards',
    description: 'KPIs, funil de conversão, evolução mensal e gargalos por etapa.',
    image: dashboardCover,
    alt: 'Profissional acompanhando indicadores de desempenho em um dashboard',
    Icon: TrendingUp,
  },
  {
    eyebrow: 'Gestão',
    title: 'Carteira do parceiro',
    description: 'Recargas via Stripe, extrato detalhado e comissões automatizadas.',
    image: walletCover,
    alt: 'Parceiro financeiro consultando a carteira de negócios no celular',
    Icon: Wallet,
  },
  {
    eyebrow: 'Capacitação',
    title: 'Universidade Mercurio',
    description: 'Trilhas de formação para parceiros com certificação ao concluir.',
    image: universityCover,
    alt: 'Equipe de profissionais participando de uma sessão de capacitação',
    Icon: GraduationCap,
  },
]

const PLATFORM_AUTOPLAY_DELAY = 5000

export function Landing() {
  const [params] = useSearchParams()
  const showPreview = params.get('preview') === '1'
  const shouldReduceMotion = useReducedMotion()
  const [platformActiveIndex, setPlatformActiveIndex] = useState(0)
  const [isPlatformPaused, setIsPlatformPaused] = useState(false)
  const [platformTrackOffset, setPlatformTrackOffset] = useState(0)
  const platformTrackRef = useRef<HTMLDivElement | null>(null)
  const platformTouchStart = useRef<number | null>(null)
  const productsSectionRef = useRef<HTMLElement | null>(null)

  const selectPlatformSlide = useCallback((index: number) => {
    setPlatformActiveIndex((index + platformSlides.length) % platformSlides.length)
  }, [])

  useEffect(() => {
    if (isPlatformPaused || shouldReduceMotion) return

    const timer = window.setTimeout(
      () => selectPlatformSlide(platformActiveIndex + 1),
      PLATFORM_AUTOPLAY_DELAY,
    )
    return () => window.clearTimeout(timer)
  }, [platformActiveIndex, isPlatformPaused, selectPlatformSlide, shouldReduceMotion])

  useLayoutEffect(() => {
    const track = platformTrackRef.current
    const firstSlide = track?.firstElementChild
    const shell = track?.parentElement?.parentElement
    if (!track || !(firstSlide instanceof HTMLElement) || !shell) return

    const updateOffset = () => {
      const slideWidth = firstSlide.getBoundingClientRect().width
      const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0
      const centeredOffset = (shell.clientWidth - slideWidth) / 2
      setPlatformTrackOffset(centeredOffset - platformActiveIndex * (slideWidth + gap))
    }

    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(shell)
    observer.observe(firstSlide)
    return () => observer.disconnect()
  }, [platformActiveIndex])

  useLayoutEffect(() => {
    const section = productsSectionRef.current
    if (!section || shouldReduceMotion) return

    const campaign = section.querySelector('.products__campaign')
    const campaignPhoto = section.querySelector('.products__photo img')
    const campaignArc = section.querySelector('.products__arc')
    const productGrid = section.querySelector('.products__grid')
    const media = gsap.matchMedia()
    const context = gsap.context(() => {
      const intro = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 76%',
          once: true,
        },
        defaults: { ease: 'power3.out' },
      })

      intro
        .from('.products__kicker', { y: 18, opacity: 0, duration: 0.5 })
        .from(
          '.products__title-line > span',
          {
            yPercent: 110,
            duration: 0.9,
            stagger: 0.08,
            clearProps: 'transform',
          },
          '-=0.25',
        )

      if (campaign) {
        intro
          .fromTo(
            campaign,
            { clipPath: 'inset(0 100% 0 0 round 24px)' },
            {
              clipPath: 'inset(0% 0% 0% 0% round 24px)',
              duration: 1.15,
              ease: 'expo.inOut',
              clearProps: 'clipPath',
            },
            '-=0.65',
          )
          .from(
            [...section.querySelectorAll('.products__campaign-copy > *'), ...section.querySelectorAll('.products__mark')],
            { y: 25, opacity: 0, duration: 0.65, stagger: 0.08 },
            '-=0.45',
          )
      }

      if (campaignPhoto) {
        intro.from(
          campaignPhoto,
          {
            xPercent: 12,
            opacity: 0,
            scale: 1.08,
            duration: 1,
            clearProps: 'transform,opacity',
          },
          '-=0.85',
        )
      }

      if (productGrid) {
        gsap.from('.products__card', {
          y: 70,
          opacity: 0,
          rotateX: -10,
          duration: 0.85,
          stagger: 0.12,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: productGrid,
            start: 'top 86%',
            once: true,
          },
        })
      }

      media.add('(min-width: 901px)', () => {
        if (campaignPhoto && campaign) {
          gsap.to(campaignPhoto, {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: {
              trigger: campaign,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.2,
            },
          })
        }

        if (campaignArc && campaign) {
          gsap.to(campaignArc, {
            rotate: 22,
            scale: 1.08,
            ease: 'none',
            scrollTrigger: {
              trigger: campaign,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.5,
            },
          })
        }
      })
    }, section)

    const refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh())

    return () => {
      window.cancelAnimationFrame(refreshFrame)
      media.revert()
      context.revert()
    }
  }, [shouldReduceMotion])

  const handleProductPointerMove = (event: PointerEvent<HTMLElement>) => {
    const card = event.currentTarget
    const bounds = card.getBoundingClientRect()
    card.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`)
    card.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`)

    if (event.pointerType === 'touch' || shouldReduceMotion) return

    const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 5
    const rotateX = -((event.clientY - bounds.top) / bounds.height - 0.5) * 5

    gsap.to(card, {
      rotateX,
      rotateY,
      y: -10,
      transformPerspective: 1000,
      transformOrigin: 'center',
      duration: 0.35,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  const handleProductPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (shouldReduceMotion) return

    gsap.to(event.currentTarget, {
      rotateX: 0,
      rotateY: 0,
      y: 0,
      duration: 0.55,
      ease: 'power3.out',
      clearProps: 'transform',
      overwrite: true,
    })
  }

  const handlePlatformKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') selectPlatformSlide(platformActiveIndex - 1)
    if (event.key === 'ArrowRight') selectPlatformSlide(platformActiveIndex + 1)
  }

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
            <a href="#simulador" className="transition hover:text-red-600">Simulador</a>
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
      <section id="home-hero" className="relative isolate min-h-[100svh] overflow-hidden bg-black text-white lg:min-h-[90vh]">
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:gap-14 sm:px-6 sm:py-16 min-[901px]:mt-10 min-[901px]:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] min-[901px]:items-center min-[901px]:gap-16 min-[901px]:py-24 xl:gap-20 xl:py-28">
          <div className="mx-auto w-full max-w-2xl min-[901px]:mx-0 min-[901px]:max-w-xl xl:max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Crédito imobiliário
            </p>
            <h1 className="mt-5 text-[clamp(2.65rem,12vw,3.75rem)] font-bold leading-[1.03] tracking-tight min-[561px]:text-6xl min-[901px]:text-[3.5rem] xl:text-[4.1rem]">
              Originação de crédito imobiliário <span className="text-red-500">sem fricção</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 sm:mt-6 sm:text-lg xl:max-w-xl xl:text-[1.15rem]">
              Home Equity, Crédito Construção e Financiamento — da simulação ao registro do contrato em uma única plataforma.
            </p>
            <div className="mt-7 flex flex-col gap-3 min-[561px]:mt-8 min-[561px]:flex-row min-[561px]:flex-wrap min-[901px]:max-w-xl">
              <Link
                to="/login"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700 min-[561px]:w-auto"
              >
                Quero ser parceiro <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/download"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-white/10 min-[561px]:w-auto"
              >
                <DownloadIcon className="h-4 w-4" /> Baixar app desktop
              </Link>
            </div>

            <nav aria-label="Ações rápidas" className="mt-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 min-[561px]:justify-start min-[561px]:gap-7">
              <Link
                to="/protocolo"
                className="inline-flex items-center gap-2 px-2 py-3 text-sm font-medium text-white/70 transition hover:text-white"
              >
                <Search className="h-4 w-4" /> Consultar protocolo
              </Link>
              <a
                href="#simulador"
                className="inline-flex items-center gap-2 px-2 py-3 text-sm font-medium text-red-300 transition hover:text-white"
              >
                Simular crédito <ArrowRight className="h-4 w-4" />
              </a>
            </nav>

            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3 border-t border-white/40 pt-6 sm:mt-12 sm:gap-6 sm:pt-8 xl:max-w-2xl">
              <Stat value="R$ 1B+" label="Originado" />
              <Stat value="98%" label="Aprovação" />
              <Stat value="3 dias" label="Análise média" />
            </div>
          </div>

          {/* Visual lateral */}
          <div className="relative block w-full min-[901px]:pl-6 xl:pl-10">
            <div className="relative mx-auto h-[450px] w-full max-w-lg sm:h-[480px] min-[901px]:h-[470px] min-[901px]:max-w-md xl:h-[500px] xl:max-w-lg">
              <motion.div
                className="absolute right-0 top-0 w-[min(18rem,calc(100vw-48px))] rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl will-change-transform min-[901px]:w-72 xl:w-80"
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
                className="absolute left-0 top-36 w-[min(20rem,calc(100vw-48px))] rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/80 to-black p-5 shadow-2xl shadow-red-900/40 will-change-transform min-[901px]:top-32 min-[901px]:w-80 xl:top-36 xl:w-[23rem]"
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
                className="absolute bottom-0 right-0 w-[min(16rem,calc(100vw-68px))] rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-4 shadow-2xl will-change-transform min-[901px]:right-4 min-[901px]:w-64 xl:right-0 xl:w-72"
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
      <section
        id="produtos"
        className="products-showcase"
        ref={productsSectionRef}
        aria-labelledby="products-title"
      >
        <div className="products__inner">
          <header className="products__header">
            <div>
              <p className="products__kicker"><span>03</span> soluções, uma única plataforma</p>
              <h2 id="products-title">
                <span className="products__title-line"><span>Crédito sob medida.</span></span>
                <span className="products__title-line products__title-line--muted"><span>Performance sem atrito.</span></span>
              </h2>
            </div>
            <p className="products__intro">
              Da primeira simulação ao registro, cada etapa opera dentro de uma esteira conectada, segura e auditável.
            </p>
          </header>

          <div className="products__campaign">
            <div className="products__arc" aria-hidden="true" />
            <div className="products__campaign-copy">
              <p className="products__campaign-eyebrow">Mercúrio One</p>
              <h3>Uma esteira.<br />Todas as possibilidades.</h3>
              <p>Simuladores dedicados, análise integrada e contratos gerados automaticamente.</p>
              <a href="#simulador" className="products__campaign-link">
                Explorar plataforma <ArrowRight aria-hidden="true" />
              </a>
            </div>

            <div className="products__mark" aria-label="Mercúrio Capital">
              <img src={logoWhite} alt="Mercúrio Capital" />
            </div>

            <div className="products__photo">
              <img
                src={executivePhoto}
                alt="Executiva analisando uma operação de crédito em um tablet"
                loading="lazy"
                onLoad={() => ScrollTrigger.refresh()}
              />
            </div>


            <div className="products__index" aria-hidden="true"><span>01</span><i /><span>03</span></div>
          </div>

          <div className="products__grid">
            {landingProducts.map((product) => (
              <article
                className={`products__card${product.featured ? ' products__card--featured' : ''}`}
                key={product.title}
                onPointerMove={handleProductPointerMove}
                onPointerLeave={handleProductPointerLeave}
              >
                <div className="products__card-glow" aria-hidden="true" />
                <div className="products__card-topline">
                  <span>{product.number}</span>
                  {product.featured && <b>Em destaque</b>}
                </div>
                <h3>{product.title}</h3>
                <p>{product.description}</p>
                <ul>
                  {product.features.map((feature) => (
                    <li key={feature}><CheckCircle2 aria-hidden="true" />{feature}</li>
                  ))}
                </ul>
                <a href="#simulador" aria-label={`Simular ${product.title}`}>
                  Simular agora <ArrowRight aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== SIMULADOR PÚBLICO ============================== */}
      <PublicSimulator embedded />

      {/* ============================== PLATAFORMA ============================== */}
      <section
        id="plataforma"
        className="platform-showcase relative overflow-hidden bg-black text-white"
        aria-roledescription="carrossel"
        aria-label="Recursos da plataforma Mercúrio"
        onMouseEnter={() => setIsPlatformPaused(true)}
        onMouseLeave={() => setIsPlatformPaused(false)}
        onFocusCapture={() => setIsPlatformPaused(true)}
        onBlurCapture={() => setIsPlatformPaused(false)}
        onKeyDown={handlePlatformKeyDown}
        onTouchStart={(event) => {
          platformTouchStart.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          if (platformTouchStart.current === null) return
          const distance = event.changedTouches[0].clientX - platformTouchStart.current
          if (Math.abs(distance) > 50) {
            selectPlatformSlide(platformActiveIndex + (distance < 0 ? 1 : -1))
          }
          platformTouchStart.current = null
        }}
      >
        <div className="platform-ambient platform-ambient-one" aria-hidden="true" />
        <div className="platform-ambient platform-ambient-two" aria-hidden="true" />

        <div className="platform-carousel-shell">
          <header className="platform-intro">
            <span className="platform-kicker">Plataforma completa</span>
            <div className="platform-heading-row">
              <h2>Tudo o que você precisa para originar e fechar</h2>
              <p>Da consulta a bureaus à assinatura digital — sem trocar de sistema.</p>
            </div>
          </header>

          <div className="platform-viewport">
            <div
              ref={platformTrackRef}
              className="platform-track"
              style={{ transform: `translateX(${platformTrackOffset}px)` }}
            >
              {platformSlides.map(({ Icon, ...slide }, index) => (
                <article
                  className={`platform-slide ${index === platformActiveIndex ? 'is-active' : ''}`}
                  key={slide.title}
                  aria-hidden={index !== platformActiveIndex}
                  aria-roledescription="slide"
                  aria-label={`${index + 1} de ${platformSlides.length}: ${slide.title}`}
                >
                  <img src={slide.image} alt={slide.alt} draggable="false" loading={index < 2 ? 'eager' : 'lazy'} />
                  <div className="platform-image-shade" aria-hidden="true" />
                  <span className="platform-slide-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="platform-slide-copy">
                    <span className="platform-eyebrow"><Icon aria-hidden="true" />{slide.eyebrow}</span>
                    <h3>{slide.title}</h3>
                    <p>{slide.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <footer className="platform-carousel-footer">
            <div className="platform-progress" aria-label="Selecionar recurso da plataforma">
              {platformSlides.map((slide, index) => (
                <button
                  className={`platform-progress-item ${index === platformActiveIndex ? 'is-active' : ''} ${index < platformActiveIndex ? 'is-complete' : ''}`}
                  key={slide.title}
                  type="button"
                  onClick={() => selectPlatformSlide(index)}
                  aria-label={`Ir para ${slide.title}`}
                  aria-current={index === platformActiveIndex ? 'true' : undefined}
                >
                  <span className="platform-progress-label">{String(index + 1).padStart(2, '0')}</span>
                  <span className="platform-progress-rail"><span className="platform-progress-fill" /></span>
                </button>
              ))}
            </div>

            <div className="platform-controls" aria-label="Navegação do carrossel">
              <button type="button" onClick={() => selectPlatformSlide(platformActiveIndex - 1)} aria-label="Recurso anterior">
                <span aria-hidden="true">←</span>
              </button>
              <span aria-live="polite">
                {String(platformActiveIndex + 1).padStart(2, '0')} / {String(platformSlides.length).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => selectPlatformSlide(platformActiveIndex + 1)} aria-label="Próximo recurso">
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </footer>
        </div>
      </section>

      <LandingConstructionSection />

      {/* ============================== CTA DOWNLOAD ============================== */}
      <section id="download-app" className="landing-download" aria-labelledby="landing-download-title">
        <div className="landing-download__grid" aria-hidden="true" />
        <div className="landing-download__noise" aria-hidden="true" />
        <div className="landing-download__light landing-download__light--top" aria-hidden="true" />
        <div className="landing-download__light landing-download__light--bottom" aria-hidden="true" />

        <div className="landing-download__content">
          <div className="landing-download__copy">
            <span className="landing-download__overline"><i aria-hidden="true" />App desktop</span>
            <h2 id="landing-download-title">Mais performance.<br />Menos fricção.</h2>
            <p className="landing-download__lead">
              A potência da plataforma em um app nativo, rápido e sempre à mão — com notificações, atalhos e acesso offline parcial.
            </p>

            <div className="landing-download__action-row">
              <Link to="/download" className="landing-download__button">
                <DownloadIcon aria-hidden="true" />
                <span>Acessar downloads</span>
                <span className="landing-download__button-shine" aria-hidden="true" />
              </Link>
              <span className="landing-download__platforms">Windows <i /> macOS <i /> Linux</span>
            </div>
            <p className="landing-download__hint">Veja as versões disponíveis para o seu computador.</p>
          </div>

          <div className="landing-download__stage" aria-hidden="true">
            <div className="landing-download__glow" />
            <div className="landing-download__orbit landing-download__orbit--one">
              <span className="landing-download__orbit-dot-track"><i /></span>
            </div>
            <div className="landing-download__orbit landing-download__orbit--two">
              <span className="landing-download__orbit-dot-track"><i /></span>
            </div>

            <div className="landing-download__device">
              <div className="landing-download__device-border">
                <div className="landing-download__window-bar">
                  <span className="landing-download__traffic-lights"><i /><i /><i /></span>
                  <span>Mercúrio Capital</span>
                  <i className="landing-download__status-dot" />
                </div>
                <div className="landing-download__app-layout">
                  <aside className="landing-download__sidebar">
                    <span className="landing-download__brand-mark">
                      <img src={logoRed} alt="" />
                    </span>
                    <i className="is-active" /><i /><i className="is-short" />
                    <span className="landing-download__avatar" />
                  </aside>
                  <div className="landing-download__dashboard">
                    <div className="landing-download__dashboard-heading">
                      <div><small>Prévia ilustrativa</small><strong>Visão geral</strong></div>
                      <span>Demonstração</span>
                    </div>
                    <div className="landing-download__stats">
                      <div><small>Propostas</small><strong>•••</strong><i /></div>
                      <div><small>Operações</small><strong>•••</strong><i /></div>
                    </div>
                    <div className="landing-download__chart-card">
                      <div><span>Atividade da equipe</span><small>Resumo</small></div>
                      <svg viewBox="0 0 420 128" role="presentation" focusable="false">
                        <defs>
                          <linearGradient id="landingDownloadChartFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ff3945" stopOpacity=".32" />
                            <stop offset="100%" stopColor="#ff3945" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path className="landing-download__chart-area" d="M0 116 C35 108 42 78 80 84 S132 108 164 71 S222 88 252 48 S310 72 342 36 S385 50 420 14 V128 H0Z" />
                        <path className="landing-download__chart-line" d="M0 116 C35 108 42 78 80 84 S132 108 164 71 S222 88 252 48 S310 72 342 36 S385 50 420 14" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="landing-download__reflection" />
            </div>

            <div className="landing-download__floating landing-download__sync-card">
              <span>↻</span><div><small>Sincronização</small><strong>Mercúrio Capital</strong></div>
            </div>
            <div className="landing-download__floating landing-download__shortcut-card">
              <small>Disponível para desktop</small><strong>Windows · macOS · Linux</strong>
            </div>
          </div>
        </div>

        <div className="landing-download__footer" aria-label="Plataformas disponíveis">
          <span>Windows</span><span>macOS</span><span>Linux</span><i aria-hidden="true" />
          <span>Downloads na página de versões</span>
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
        <AtmosphereBackground />

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
                  <span className="font-semibold text-white">CNPJ:</span> 64.382.034/0001-70
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
                  <span className="build-version" aria-label="Build version">v0.2.2</span>
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

function AtmosphereBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 -left-24 h-[300px] w-[300px] rounded-full bg-red-600/20 blur-[100px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '47px 47px',
        }}
      />
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="whitespace-nowrap text-[clamp(1rem,5.5vw,1.5rem)] font-bold text-white sm:text-3xl">{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.06em] text-white/50 sm:text-xs sm:tracking-wider">{label}</p>
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

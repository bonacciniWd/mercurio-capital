import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, ArrowLeft, ChevronRight } from 'lucide-react'

import bannerImg  from '@/assets/promotions/banner.jpeg'
import promo1Img  from '@/assets/promotions/promo.jpeg'
import promo2Img  from '@/assets/promotions/promo2.jpeg'
import promo3Img  from '@/assets/promotions/promo3.jpeg'
import logoWide   from '@/assets/logos/logowide.png'

const STORAGE_KEY = 'mercurio:partner_tour_completed_v1'

interface Step {
  tag: string
  title: string
  body: string
  media: string          // .gif | .mp4 | .webm | image
  cta?: { label: string; to: string }
}

const STEPS: Step[] = [
  {
    tag: 'Bem-vindo',
    title: 'Seu painel de parceiro',
    body: 'Em poucos passos vamos te mostrar como navegar, criar propostas e acompanhar comissões na Mercúrio Capital.',
    media: bannerImg,
  },
  {
    tag: 'Passo 1 de 4',
    title: 'Simule antes de propor',
    body: 'A página Simulações ajuda você a explicar números ao cliente sem gastar saldo da carteira. Use-a antes de criar a proposta oficial.',
    media: promo1Img,
    cta: { label: 'Abrir Simulações', to: '/p/simulacoes' },
  },
  {
    tag: 'Passo 2 de 4',
    title: 'Crie sua primeira proposta',
    body: 'O wizard cobra uma pequena taxa da sua carteira por análise e te leva até o protocolo do cliente em minutos.',
    media: promo2Img,
    cta: { label: 'Nova proposta', to: '/p/propostas/nova' },
  },
  {
    tag: 'Passo 3 de 4',
    title: 'Acompanhe pela Carteira',
    body: 'Em Carteira você vê saldo, recargas e movimentações. Recarregue antes de iniciar muitos protocolos.',
    media: promo3Img,
    cta: { label: 'Ver carteira', to: '/p/carteira' },
  },
  {
    tag: 'Passo 4 de 4',
    title: 'Comissões e milestones',
    body: 'Conforme suas propostas avançam, você desbloqueia milestones e libera comissões. Acompanhe nas seções específicas do painel.',
    media: bannerImg,
  },
]

export function PartnerOnboardingTour() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const done = window.localStorage.getItem(STORAGE_KEY)
    if (!done) setOpen(true)
  }, [])

  function finish() {
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    setOpen(false)
  }

  if (!open) return null
  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={finish}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* ── Image / video header ── */}
        <div className="relative h-76 overflow-hidden bg-navy">
          {/\.(mp4|webm)$/i.test(s.media) ? (
            <video
              key={s.media}
              src={s.media}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              key={s.media}
              src={s.media}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/25" />

          {/* Logo */}
          <div className="absolute left-4 top-4">
            <img src={logoWide} alt="Mercúrio Capital" className="h-5 brightness-0 invert" />
          </div>

          {/* Close */}
          <button
            onClick={finish}
            aria-label="Fechar tour"
            className="btn-no-liquid absolute right-3 top-3 rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Step tag */}
          <div className="absolute bottom-4 left-4">
            <span className="inline-block rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
              {s.tag}
            </span>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-6 pb-6 pt-5">
          <h2 id="tour-title" className="text-xl font-bold text-navy">
            {s.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-silver-600">
            {s.body}
          </p>

          {/* Progress pill dots */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`block rounded-full transition-all duration-300 ${
                  i === step
                    ? 'h-2 w-6 bg-red-600'
                    : i < step
                    ? 'h-2 w-2 bg-red-300'
                    : 'h-2 w-2 bg-silver-200'
                }`}
              />
            ))}
          </div>

          {/* ── Optional CTA ── */}
          {s.cta && (
            <button
              onClick={() => { finish(); navigate(s.cta!.to) }}
              className="btn-no-liquid mt-5 flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
            >
              {s.cta.label}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* ── Navigation ── */}
          <div className="mt-3 flex items-center gap-2">
            {/* Back */}
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              aria-label="Voltar"
              className="btn-no-liquid shrink-0 rounded-lg border border-silver-200 p-2.5 text-silver-600 transition-colors hover:bg-silver-50 disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-1 flex-col gap-2">
              {/* Next / Finish */}
              {isLast ? (
                <button
                  onClick={finish}
                  className="btn-no-liquid w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
                >
                  Tudo certo, vamos lá! 🚀
                </button>
              ) : (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="btn-no-liquid flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={finish}
            className="btn-no-liquid mt-4 w-full text-center text-xs text-silver-400 transition-colors hover:text-silver-600"
          >
            Pular tour
          </button>
        </div>
      </div>
    </div>
  )
}

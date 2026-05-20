import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'

const STORAGE_KEY = 'mercurio:partner_tour_completed_v1'

interface Step {
  title: string
  body: string
  cta?: { label: string; to: string }
}

const STEPS: Step[] = [
  {
    title: 'Bem-vindo à Mercúrio Capital',
    body: 'Este é o seu painel de parceiro. Em poucos passos vamos te mostrar como navegar, criar propostas e acompanhar comissões.',
  },
  {
    title: '1. Simule antes de propor',
    body: 'A página Simulações ajuda você a explicar números ao cliente sem gastar saldo da carteira. Use-a antes de criar a proposta oficial.',
    cta: { label: 'Abrir Simulações', to: '/p/simulacoes' },
  },
  {
    title: '2. Crie sua primeira proposta',
    body: 'O wizard cobra uma pequena taxa da sua carteira por análise e te leva até o protocolo do cliente em minutos.',
    cta: { label: 'Nova proposta', to: '/p/propostas/nova' },
  },
  {
    title: '3. Acompanhe pela Carteira',
    body: 'Em Carteira você vê saldo, recargas e movimentações. Recarregue antes de iniciar muitos protocolos.',
    cta: { label: 'Ver carteira', to: '/p/carteira' },
  },
  {
    title: '4. Comissões e milestones',
    body: 'Conforme suas propostas avançam, você desbloqueia milestones e libera comissões. Acompanhe nas seções específicas.',
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
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={finish} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title"
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
        <button onClick={finish} aria-label="Fechar tour"
          className="absolute right-3 top-3 text-silver-500 hover:text-navy">
          <X className="h-5 w-5" />
        </button>
        <div className="p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gold-600">
            <Sparkles className="h-4 w-4" /> Tour rápido
          </div>
          <h2 id="tour-title" className="mt-2 text-xl font-bold text-navy">{s.title}</h2>
          <p className="mt-2 text-sm text-silver-600 leading-relaxed">{s.body}</p>

          {/* progress */}
          <div className="mt-4 flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-gold' : 'bg-silver-200'}`} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-silver-600 disabled:opacity-40 hover:text-navy">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="flex gap-2">
              {s.cta && (
                <button className="btn-outline"
                  onClick={() => { finish(); navigate(s.cta!.to) }}>
                  {s.cta.label}
                </button>
              )}
              {isLast ? (
                <button className="btn-gold" onClick={finish}>Concluir</button>
              ) : (
                <button className="btn-gold" onClick={() => setStep(s => s + 1)}>
                  Próximo <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <button onClick={finish} className="mt-3 block w-full text-center text-xs text-silver-400 hover:text-silver-600">
            Não mostrar novamente
          </button>
        </div>
      </div>
    </div>
  )
}

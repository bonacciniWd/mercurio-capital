import { useEffect, useRef, useState } from 'react'
import { useElectricCanvas } from '@/hooks/useElectricCanvas'
import { brl } from '@/lib/utils'
import { Lock, CheckCircle2 } from 'lucide-react'

// Mock: CGI liberado pelo parceiro (centavos)
const CURRENT_CGI = 1_250_000_000 // R$ 12.500.000,00

const MILESTONES = [
  {
    target: 500_000_000,     // R$ 5.000.000,00
    label: 'R$ 5 Milhões',
    prize: 'Rolex Oyster Perpetual',
    img: new URL('../../assets/milestones/prem1.svg', import.meta.url).href,
    desc: 'O ícone do sucesso. Conquiste R$ 5M em liberações CGI e ganhe um Rolex Submariner.',
    color: '#D4AF37',
  },
  {
    target: 5_000_000_000,   // R$ 50.000.000,00
    label: 'R$ 50 Milhões',
    prize: 'BMW 330e M Sport',
    img: new URL('../../assets/milestones/prem2.svg', import.meta.url).href,
    desc: 'Performance híbrida e luxo. Libere R$ 50M em CGI e ganhe um BMW 330e M Sport.',
    color: '#60a5fa',
  },
  {
    target: 10_000_000_000,  // R$ 100.000.000,00
    label: 'R$ 100 Milhões',
    prize: 'Corvette C8',
    img: new URL('../../assets/milestones/prem3.svg', import.meta.url).href,
    desc: 'O ápice dos milestones. Libere R$ 100M em CGI e conquiste um Corvette C8.',
    color: '#f87171',
  },
]

// Quanto o canvas ultrapassa cada lado do card para gerar o efeito de borda fora do overflow-hidden
const OFFSET = 32

function MilestoneCard({ m }: { m: typeof MILESTONES[0] }) {
  const unlocked = CURRENT_CGI >= m.target
  const progress = Math.min(100, (CURRENT_CGI / m.target) * 100)

  // Measure the wrapper div and sync canvas dimensions dynamically
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useElectricCanvas({
    color: m.color,
    displacement: unlocked ? 42 : 22,
    offset: OFFSET,
    borderRadius: 20,
    speed: unlocked ? 2.2 : 0.8,
    lineWidth: unlocked ? 2 : 1,
  })

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return
    const update = () => {
      canvas.width = wrapper.offsetWidth + 2 * OFFSET
      canvas.height = wrapper.offsetHeight + 2 * OFFSET
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [canvasRef])

  return (
    <div
      ref={wrapperRef}
      className="relative"
      style={{
        padding: 2,
        borderRadius: 24,
        background: `linear-gradient(-30deg, ${m.color}28, transparent 50%, ${m.color}28)`,
      }}
    >
      {/* Electric canvas — fora do overflow-hidden; dimensões atualizadas pelo ResizeObserver */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{ top: -OFFSET, left: -OFFSET, zIndex: 10 }}
      />

      {/* Card body */}
      <div
        className="relative flex flex-col overflow-hidden rounded-[22px] p-6"
        style={{
          background: 'linear-gradient(155deg, #0c1626 0%, #07101e 100%)',
          minHeight: 340,
        }}
      >
        {/* Radial glow se conquistado */}
        {unlocked && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${m.color}22 0%, transparent 60%)`,
              zIndex: 1,
            }}
          />
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: m.color }}>
              {m.label}
            </span>
            {unlocked ? (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}40` }}
              >
                <CheckCircle2 className="h-3 w-3" /> Conquistado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-white/30">
                <Lock className="h-3.5 w-3.5" /> Bloqueado
              </span>
            )}
          </div>

          {/* Prize image */}
          <div
            className="my-4 flex items-center justify-center"
            style={{
              filter: unlocked ? `drop-shadow(0 0 22px ${m.color}bb)` : 'grayscale(1) opacity(0.3)',
              transition: 'filter 0.4s ease',
            }}
          >
            <img src={m.img} alt={m.prize} width={300} height={250} style={{ width: '100%', height: 'auto', maxHeight: 140, objectFit: 'contain' }} />
          </div>

          {/* Prize name + desc */}
          <h3 className="text-lg font-bold text-white">{m.prize}</h3>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-white/40">{m.desc}</p>

          {/* Progress */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-white/35">{brl(Math.min(CURRENT_CGI, m.target))} liberados</span>
              <span style={{ color: m.color }}>{progress >= 100 ? '100%' : `${progress.toFixed(1)}%`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${m.color}80, ${m.color})`,
                  boxShadow: unlocked ? `0 0 10px ${m.color}90` : 'none',
                }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-white/25">Meta: {brl(m.target)}</p>
          </div>
        </div>
      </div>

      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          borderRadius: 24,
          background: `linear-gradient(-30deg, ${m.color}, transparent, ${m.color})`,
          filter: 'blur(32px)',
          transform: 'scale(1.15)',
          opacity: unlocked ? 0.32 : 0.12,
        }}
      />
    </div>
  )
}

export function PartnerMilestones() {
  const overallPct = Math.min(100, (CURRENT_CGI / 10_000_000_000) * 100)

  // Animate bar 0 → overallPct after mount for visual expansion effect
  const [displayPct, setDisplayPct] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setDisplayPct(overallPct), 120)
    return () => clearTimeout(t)
  }, [overallPct])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <style>{`
        @keyframes bar-pulse {
          0%, 100% { box-shadow: 0 0 8px 3px rgba(239,68,68,0.55); }
          50%        { box-shadow: 0 0 22px 8px rgba(239,68,68,0.90); }
        }
      `}</style>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Programa de Milestones</h1>
        <p className="mt-1 text-sm text-silver-600">
          Libere crédito CGI e conquiste prêmios exclusivos. Quanto mais você libera, maiores as recompensas.
        </p>
      </div>

      {/* Hero de progresso */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, #07101e 0%, #0d1c32 100%)',
          border: '1px solid rgba(212,175,55,0.18)',
        }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(212,175,55,0.12) 0%, transparent 60%)' }} />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-gold/60">Total Liberado em CGI</p>
          <p className="mt-1 text-4xl font-bold text-gold">{brl(CURRENT_CGI)}</p>
          <p className="mt-1 text-sm text-white/35">12 contratos fechados · Atualizado em 27/04/2026</p>

          {/* Barra geral */}
          <div className="mt-5">
            <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                style={{
                  width: `${displayPct}%`,
                  height: '100%',
                  borderRadius: 9999,
                  background: '#ef4444',
                  animation: 'bar-pulse 1.8s ease-in-out infinite',
                  transition: 'width 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
              {/* Ticks em 5% (R$5M) e 50% (R$50M) do range total de 100M */}
              {[{ pct: 5, label: '⌚' }, { pct: 50, label: '🚗' }].map(({ pct, label }) => (
                <div key={pct} className="absolute top-0 h-full w-px" style={{ left: `${pct}%`, background: 'rgba(255,255,255,0.35)' }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px]">{label}</span>
                </div>
              ))}
            </div>
            {/* Labels posicionados sobre a barra */}
            <div className="relative mt-1 h-4">
              <span className="absolute left-0 text-[10px] text-white/30">R$ 0</span>
              <span className="absolute text-[10px] text-white/30" style={{ left: '5%', transform: 'translateX(-50%)' }}>R$ 5M</span>
              <span className="absolute text-[10px] text-white/30" style={{ left: '50%', transform: 'translateX(-50%)' }}>R$ 50M</span>
              <span className="absolute right-0 text-[10px] text-white/30">R$ 100M</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {MILESTONES.map(m => (
          <MilestoneCard key={m.prize} m={m} />
        ))}
      </div>

      <p className="text-center text-xs text-silver-400">
        Prêmios entregues após validação da equipe Mercurio Capital.{' '}
        <a href="#" className="underline hover:text-silver-600">Ver regulamento completo</a>
      </p>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useElectricCanvas } from '@/hooks/useElectricCanvas'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { Lock, CheckCircle2, Loader2 } from 'lucide-react'

interface KpiRow {
  partner_id: string
  ganhas: number
  volume_ganho: number
}

interface Milestone {
  id: string
  order_index: number
  label: string
  prize: string
  descricao: string | null
  target_centavos: number
  color: string
  image_url: string | null
  image_storage_path: string | null
  ativo: boolean
}

const OFFSET = 32

function resolveImageUrl(m: Milestone): string | null {
  if (m.image_storage_path) {
    const { data } = supabase.storage.from('milestone-images').getPublicUrl(m.image_storage_path)
    return data.publicUrl
  }
  return m.image_url // pode ser URL absoluta ou path relativo tipo /milestones/prem1.svg
}

function MilestoneCard({ m, currentCgi }: { m: Milestone; currentCgi: number }) {
  const target = Number(m.target_centavos)
  const unlocked = currentCgi >= target
  const progress = target > 0 ? Math.min(100, (currentCgi / target) * 100) : 0
  const img = resolveImageUrl(m)

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
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{ top: -OFFSET, left: -OFFSET, zIndex: 10 }}
      />

      <div
        className="relative flex flex-col overflow-hidden rounded-[22px] p-6"
        style={{
          background: 'linear-gradient(155deg, #0c1626 0%, #07101e 100%)',
          minHeight: 340,
        }}
      >
        {unlocked && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${m.color}22 0%, transparent 60%)`,
              zIndex: 1,
            }}
          />
        )}

        <div className="relative z-10 flex flex-1 flex-col">
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

          <div
            className="my-4 flex items-center justify-center"
            style={{
              filter: unlocked ? `drop-shadow(0 0 22px ${m.color}bb)` : 'grayscale(1) opacity(0.3)',
              transition: 'filter 0.4s ease',
              minHeight: 140,
            }}
          >
            {img ? (
              <img src={img} alt={m.prize} width={300} height={250}
                style={{ width: '100%', height: 'auto', maxHeight: 140, objectFit: 'contain' }} />
            ) : (
              <div className="text-xs text-white/20">sem imagem</div>
            )}
          </div>

          <h3 className="text-lg font-bold text-white">{m.prize}</h3>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-white/40">{m.descricao ?? ''}</p>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-white/35">{brl(Math.min(currentCgi, target))} liberados</span>
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
            <p className="mt-1 text-right text-[10px] text-white/25">Meta: {brl(target)}</p>
          </div>
        </div>
      </div>

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
  const kpiQuery = useQuery({
    queryKey: ['p-kpis-milestones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_dashboard_kpis')
        .select('partner_id, ganhas, volume_ganho')
        .maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })

  const milestonesQuery = useQuery({
    queryKey: ['partner-milestones-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_milestones')
        .select('*')
        .eq('ativo', true)
        .order('order_index')
      if (error) throw error
      return (data ?? []) as Milestone[]
    },
  })

  // volume_ganho vem em reais (padrao da view) — convertemos para centavos p/ uso com brl()
  const currentCgi = Math.round(Number(kpiQuery.data?.volume_ganho ?? 0) * 100)
  const contratosCount = Number(kpiQuery.data?.ganhas ?? 0)
  const milestones = milestonesQuery.data ?? []
  const maxTarget = milestones.length
    ? Math.max(...milestones.map(m => Number(m.target_centavos)))
    : 0
  const overallPct = maxTarget > 0 ? Math.min(100, (currentCgi / maxTarget) * 100) : 0

  const [displayPct, setDisplayPct] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setDisplayPct(overallPct), 120)
    return () => clearTimeout(t)
  }, [overallPct])

  const atualizadoEm = new Date().toLocaleDateString('pt-BR')

  if (kpiQuery.isLoading || milestonesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    )
  }

  // Ticks intermediarios (todos exceto o de maior target)
  const intermediateMilestones = milestones.filter(m => Number(m.target_centavos) < maxTarget)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <style>{`
        @keyframes bar-pulse {
          0%, 100% { box-shadow: 0 0 8px 3px rgba(239,68,68,0.55); }
          50%        { box-shadow: 0 0 22px 8px rgba(239,68,68,0.90); }
        }
      `}</style>

      <div>
        <h1 className="text-2xl font-bold text-navy">Programa de Milestones</h1>
        <p className="mt-1 text-sm text-silver-600">
          Libere credito CGI e conquiste premios exclusivos. Quanto mais voce libera, maiores as recompensas.
        </p>
      </div>

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
          <p className="mt-1 text-4xl font-bold text-gold">{brl(currentCgi)}</p>
          <p className="mt-1 text-sm text-white/35">
            {contratosCount} {contratosCount === 1 ? 'contrato fechado' : 'contratos fechados'} · Atualizado em {atualizadoEm}
          </p>

          {maxTarget > 0 && (
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
                {intermediateMilestones.map(m => {
                  const pct = (Number(m.target_centavos) / maxTarget) * 100
                  return (
                    <div key={m.id} className="absolute top-0 h-full w-px"
                      style={{ left: `${pct}%`, background: 'rgba(255,255,255,0.35)' }} />
                  )
                })}
              </div>
              <div className="relative mt-1 h-4">
                <span className="absolute left-0 text-[10px] text-white/30">R$ 0</span>
                {milestones.map(m => {
                  const pct = (Number(m.target_centavos) / maxTarget) * 100
                  return (
                    <span key={m.id} className="absolute text-[10px] text-white/30"
                      style={{ left: `${pct}%`, transform: pct >= 99 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                      {m.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="rounded-xl border border-silver-200 bg-white p-10 text-center text-sm text-silver-500">
          Nenhum milestone cadastrado ainda.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {milestones.map(m => (
            <MilestoneCard key={m.id} m={m} currentCgi={currentCgi} />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-silver-400">
        Premios entregues apos validacao da equipe Mercurio Capital.{' '}
        <a href="#" className="underline hover:text-silver-600">Ver regulamento completo</a>
      </p>
    </div>
  )
}


import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useElectricCanvas } from '@/hooks/useElectricCanvas'

interface Props {
  srcs: string[]
  alt?: string
  href?: string
  to?: string
  interval?: number
}

// Canvas dimensions for sidebar context
const CARD_W = 230
const CARD_H = 340
const OFFSET = 30
const CANVAS_W = CARD_W + OFFSET * 2
const CANVAS_H = CARD_H + OFFSET * 2

export function ElectricBannerCard({ srcs, alt = 'Promoção', href, to, interval = 5000 }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [prevIdx, setPrevIdx] = useState<number | null>(null)
  const [fading, setFading] = useState(false)
  const canvasRef = useElectricCanvas({ color: '#dd8448', displacement: 30, offset: OFFSET, borderRadius: 14 })

  // Auto-rotate with crossfade
  useEffect(() => {
    if (srcs.length <= 1) return
    const id = setInterval(() => {
      setPrevIdx(activeIdx)
      setFading(true)
      setActiveIdx(i => (i + 1) % srcs.length)
      setTimeout(() => { setPrevIdx(null); setFading(false) }, 600)
    }, interval)
    return () => clearInterval(id)
  }, [activeIdx, srcs.length, interval])

  const card = (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ width: CARD_W, height: CARD_H }}
    >
      {/* Previous image fading out */}
      {prevIdx !== null && (
        <img
          key={`prev-${prevIdx}`}
          src={srcs[prevIdx]}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ zIndex: 1, opacity: fading ? 0 : 1, transition: 'opacity 0.6s ease' }}
        />
      )}
      {/* Active image fading in */}
      <img
        key={`active-${activeIdx}`}
        src={srcs[activeIdx]}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ zIndex: 1, opacity: fading ? 1 : 1, transition: 'opacity 0.6s ease' }}
      />
      {/* Dot indicators */}
      {srcs.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1">
          {srcs.map((_, i) => (
            <button
              key={i}
              onClick={() => { setPrevIdx(activeIdx); setFading(true); setActiveIdx(i); setTimeout(() => { setPrevIdx(null); setFading(false) }, 600) }}
              className="h-0.5 rounded-full transition-all"
              style={{ width: i === activeIdx ? 6 : 2, background: i === activeIdx ? '#D4AF37' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}

      {/* Fallback background when no image */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #1a0f00 0%, #3a1f05 50%, #1a0f00 100%)',
          zIndex: 0,
        }}
      />

      {/* Bottom gradient overlay for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent 40%, rgba(7,16,30,0.65) 100%)',
          zIndex: 2,
          borderRadius: 'inherit',
        }}
      />

      {/* Glow layer 1 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          border: '2px solid rgba(221,132,72,0.5)',
          borderRadius: 'inherit',
          filter: 'blur(1px)',
          zIndex: 3,
        }}
      />

      {/* Glow layer 2 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          border: '2px solid rgba(221,132,72,0.8)',
          borderRadius: 'inherit',
          filter: 'blur(4px)',
          zIndex: 3,
        }}
      />

      {/* Electric border canvas — extends beyond card bounds */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="pointer-events-none absolute"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 4,
        }}
      />
    </div>
  )

  return (
    <div
      className="relative"
      style={{
        padding: '2px',
        borderRadius: 18,
        background: 'linear-gradient(-30deg, rgba(221,132,72,0.18), transparent 50%, rgba(221,132,72,0.18))',
      }}
    >
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block">
          {card}
        </a>
      ) : to ? (
        <Link to={to} className="block cursor-pointer">
          {card}
        </Link>
      ) : (
        card
      )}

      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          borderRadius: 18,
          background: 'linear-gradient(-30deg, #dd8448, transparent, #dd8448)',
          filter: 'blur(28px)',
          transform: 'scale(1.15)',
          opacity: 0.18,
        }}
      />
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ArrowLeft, Minus, Plus, RotateCcw } from 'lucide-react'
import worldSvg from '@/assets/maps/world.svg?raw'
import brazilSvg from '@/assets/maps/br-ufs.svg?raw'
import { UF_BY_IBGE_CODE } from '@/lib/brStates'

type Shape = { id: string; title: string; d: string }
type View = { x: number; y: number; width: number; height: number }

const countryNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' })

function parseMap(raw: string, kind: 'world' | 'brazil'): { view: View; shapes: Shape[]; transform?: string } {
  const root = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement
  const bounds = root.getAttribute('viewBox')?.split(/\s+/).map(Number)
  const view = bounds?.length === 4 && bounds.every(Number.isFinite)
    ? { x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3] }
    : { x: 0, y: 0, width: 1009.6727, height: 665.96301 }
  const shapes = [...root.querySelectorAll('path')].flatMap(path => {
    const id = path.getAttribute('id') ?? ''
    const d = path.getAttribute('d') ?? ''
    if (!d || (kind === 'world' ? !/^[A-Z]{2}$/.test(id) : !UF_BY_IBGE_CODE[id])) return []
    return [{ id: kind === 'world' ? id : UF_BY_IBGE_CODE[id], title: kind === 'world' ? (countryNames.of(id) ?? path.getAttribute('title') ?? id) : UF_BY_IBGE_CODE[id], d }]
  })
  return { view, shapes, transform: kind === 'brazil' ? root.querySelector('g')?.getAttribute('transform') ?? undefined : undefined }
}

function clampedView(next: View, base: View): View {
  const width = Math.max(base.width / 8, Math.min(base.width, next.width))
  const height = Math.max(base.height / 8, Math.min(base.height, next.height))
  return {
    x: Math.min(base.x + base.width - width, Math.max(base.x, next.x)),
    y: Math.min(base.y + base.height - height, Math.max(base.y, next.y)),
    width, height,
  }
}

export function LeadGeographyMap({ ufCounts, locatedCount, selectedRegion, onSelectRegion }: {
  ufCounts: Record<string, number>
  locatedCount: number
  selectedRegion: string
  onSelectRegion: (region: string) => void
}) {
  const world = useMemo(() => parseMap(worldSvg, 'world'), [])
  const brazil = useMemo(() => parseMap(brazilSvg, 'brazil'), [])
  const [scope, setScope] = useState<'world' | 'brazil'>('world')
  const base = scope === 'world' ? world.view : brazil.view
  const map = scope === 'world' ? world : brazil
  const [viewport, setViewport] = useState<View | null>(null)
  const view = viewport ?? base
  const [hovered, setHovered] = useState<Shape | null>(null)
  const pointer = useRef<{ x: number; y: number; view: View; moved: boolean; shapeId: string | null } | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const element = svg.current
    if (!element) return
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const anchorX = (event.clientX - rect.left) / rect.width
      const anchorY = (event.clientY - rect.top) / rect.height
      const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2
      setViewport(current => {
        const active = current ?? base
        const width = active.width / factor
        const height = active.height / factor
        return clampedView({ x: active.x + (active.width - width) * anchorX, y: active.y + (active.height - height) * anchorY, width, height }, base)
      })
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [base])

  function zoom(factor: number, anchorX = .5, anchorY = .5) {
    const width = view.width / factor
    const height = view.height / factor
    setViewport(clampedView({ x: view.x + (view.width - width) * anchorX, y: view.y + (view.height - height) * anchorY, width, height }, base))
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const target = event.target
    pointer.current = { x: event.clientX, y: event.clientY, view, moved: false, shapeId: target instanceof SVGPathElement ? target.dataset.shapeId ?? null : null }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = pointer.current
    const rect = svg.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
    if (!drag.moved) return
    setViewport(clampedView({ ...drag.view, x: drag.view.x - dx / rect.width * drag.view.width, y: drag.view.y - dy / rect.height * drag.view.height }, base))
  }

  function onShapeClick(shape: Shape) {
    if (pointer.current?.moved) return
    if (scope === 'world' && shape.id === 'BR') {
      setScope('brazil')
      setViewport(null)
      setHovered(null)
    } else if (scope === 'brazil') {
      onSelectRegion(selectedRegion === shape.id ? 'all' : shape.id)
    }
  }

  function shapeCount(shape: Shape) { return scope === 'world' ? shape.id === 'BR' ? locatedCount : 0 : ufCounts[shape.id] ?? 0 }
  const maxUfCount = Math.max(0, ...Object.values(ufCounts))
  function densityFill(count: number) {
    if (!count || !maxUfCount) return '#eeeae8'
    const strength = Math.max(.18, Math.log1p(count) / Math.log1p(maxUfCount))
    const channel = Math.round(248 - strength * 65).toString(16).padStart(2, '0')
    return `#${channel}3029`
  }

  return <div className="admin-leads__map-interactive">
    <div className="admin-leads__map-tools">
      {scope === 'brazil' && <button type="button" className="btn-no-liquid is-back" onClick={() => { setScope('world'); setViewport(null); setHovered(null) }} aria-label="Voltar ao mapa mundial"><ArrowLeft size={14} /> Mundo</button>}
      <button type="button" className="btn-no-liquid" onClick={() => zoom(1.25)} aria-label="Aproximar mapa"><Plus size={16} /></button>
      <button type="button" className="btn-no-liquid" onClick={() => zoom(1 / 1.25)} aria-label="Afastar mapa"><Minus size={16} /></button>
      <button type="button" className="btn-no-liquid" onClick={() => setViewport(null)} aria-label="Restaurar mapa"><RotateCcw size={16} /></button>
    </div>
    <svg ref={svg} role="group" aria-label={scope === 'world' ? 'Mapa mundial interativo. Selecione o Brasil para ver os estados.' : 'Mapa do Brasil interativo por unidade federativa.'}
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={event => {
        const active = pointer.current
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (active && !active.moved && active.shapeId) {
          const shape = map.shapes.find(item => item.id === active.shapeId)
          if (shape) onShapeClick(shape)
        }
        pointer.current = null
      }}
      onPointerCancel={() => { pointer.current = null }} onPointerLeave={() => setHovered(null)}>
      <g transform={map.transform}>
        {map.shapes.map(shape => <path key={shape.id} data-shape-id={shape.id} d={shape.d} tabIndex={0} role={scope === 'world' && shape.id !== 'BR' ? 'img' : 'button'}
          aria-label={`${shape.title}: ${shapeCount(shape)} ${shapeCount(shape) === 1 ? 'lead' : 'leads'}${scope === 'world' && shape.id !== 'BR' ? ', sem localização identificada' : ''}`}
          className={`admin-leads__map-shape${scope === 'world' ? ' is-country' : ' is-state'}${(scope === 'world' && shape.id === 'BR') || (scope === 'brazil' && selectedRegion === shape.id) ? ' is-active' : ''}`}
          style={scope === 'brazil' ? { fill: densityFill(shapeCount(shape)) } : undefined}
          onPointerEnter={() => setHovered(shape)} onFocus={() => setHovered(shape)} onBlur={() => setHovered(null)}
          onKeyDown={event => { if ((scope === 'brazil' || shape.id === 'BR') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onShapeClick(shape) } }} />)}
      </g>
    </svg>
    <div className="admin-leads__map-hint" role="status" aria-live="polite">
      {hovered ? `${hovered.title}: ${shapeCount(hovered)} ${shapeCount(hovered) === 1 ? 'lead' : 'leads'}` : scope === 'world' ? 'Passe sobre um país · selecione o Brasil para ver as UFs' : 'Passe sobre uma UF · selecione para filtrar'}
    </div>
  </div>
}

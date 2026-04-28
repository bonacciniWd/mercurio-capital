import { useEffect, useRef } from 'react'

export interface ElectricOpts {
  color?: string
  speed?: number
  displacement?: number
  borderRadius?: number
  offset?: number
  lineWidth?: number
}

export function useElectricCanvas(opts: ElectricOpts = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const o = {
      octaves: 10, lacunarity: 1.6, gain: 0.7,
      amplitude: 0.075, frequency: 10, baseFlatness: 0,
      displacement: opts.displacement ?? 30,
      speed: opts.speed ?? 1.5,
      borderOffset: opts.offset ?? 30,
      borderRadius: opts.borderRadius ?? 14,
      lineWidth: opts.lineWidth ?? 1,
      color: opts.color ?? '#dd8448',
    }

    let animId: number, time = 0, lastFrame = 0

    const random = (x: number) => (Math.sin(x * 12.9898) * 43758.5453) % 1

    const noise2D = (x: number, y: number) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j
      const a = random(i + j * 57), b = random(i + 1 + j * 57)
      const c = random(i + (j + 1) * 57), d = random(i + 1 + (j + 1) * 57)
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
    }

    const fBm = (x: number, t: number, seed: number) => {
      let y = 0, amp = o.amplitude, freq = o.frequency
      for (let i = 0; i < o.octaves; i++) {
        y += (i === 0 ? amp * o.baseFlatness : amp) * noise2D(freq * x + seed * 100, t * freq * 0.3)
        freq *= o.lacunarity; amp *= o.gain
      }
      return y
    }

    const corner = (cx: number, cy: number, r: number, s: number, arc: number, p: number) => {
      const a = s + p * arc; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
    }

    const rrPt = (t: number, l: number, top: number, w: number, h: number, r: number) => {
      const sw = w - 2 * r, sh = h - 2 * r, ca = Math.PI * r / 2
      const perim = 2 * sw + 2 * sh + 4 * ca, d = t * perim
      let acc = 0
      if (d <= acc + sw) return { x: l + r + (d - acc) / sw * sw, y: top }; acc += sw
      if (d <= acc + ca) return corner(l + w - r, top + r, r, -Math.PI / 2, Math.PI / 2, (d - acc) / ca); acc += ca
      if (d <= acc + sh) return { x: l + w, y: top + r + (d - acc) / sh * sh }; acc += sh
      if (d <= acc + ca) return corner(l + w - r, top + h - r, r, 0, Math.PI / 2, (d - acc) / ca); acc += ca
      if (d <= acc + sw) return { x: l + w - r - (d - acc) / sw * sw, y: top + h }; acc += sw
      if (d <= acc + ca) return corner(l + r, top + h - r, r, Math.PI / 2, Math.PI / 2, (d - acc) / ca); acc += ca
      if (d <= acc + sh) return { x: l, y: top + h - r - (d - acc) / sh * sh }; acc += sh
      return corner(l + r, top + r, r, Math.PI, Math.PI / 2, (d - acc) / ca)
    }

    const draw = (now: number) => {
      time += ((now - lastFrame) / 1000) * o.speed; lastFrame = now
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = o.color; ctx.lineWidth = o.lineWidth
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      const bo = o.borderOffset, bw = canvas.width - 2 * bo, bh = canvas.height - 2 * bo
      const r = Math.min(o.borderRadius, Math.min(bw, bh) / 2)
      const sc = Math.floor((2 * (bw + bh) + 2 * Math.PI * r) / 2)
      ctx.beginPath()
      for (let i = 0; i <= sc; i++) {
        const p = i / sc, pt = rrPt(p, bo, bo, bw, bh, r)
        const dx = pt.x + fBm(p * 8, time, 0) * o.displacement
        const dy = pt.y + fBm(p * 8, time, 1) * o.displacement
        if (i === 0) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy)
      }
      ctx.closePath(); ctx.stroke()
      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.color, opts.speed, opts.displacement, opts.borderRadius, opts.offset, opts.lineWidth])

  return canvasRef
}

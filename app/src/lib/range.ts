export function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  const normalized = Math.trunc(value)
  return Math.min(max, Math.max(min, normalized))
}

export function parseRangeInteger(rawValue: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(rawValue, 10)
  if (Number.isNaN(parsed)) {
    return clampInteger(fallback, min, max)
  }
  return clampInteger(parsed, min, max)
}

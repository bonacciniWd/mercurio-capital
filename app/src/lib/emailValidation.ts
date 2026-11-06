const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmailFormat(value: string): boolean {
  const normalized = normalizeEmail(value)
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized)
}

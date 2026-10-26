const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'

type DateParts = { year: string; month: string; day: string }

const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function partsInBrazil(date: Date): DateParts {
  const parts = datePartsFormatter.formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: values.year ?? '',
    month: values.month ?? '',
    day: values.day ?? '',
  }
}

function isLegacyDateOnlyTimestamp(iso: string): boolean {
  const date = new Date(iso)
  return Number.isFinite(date.getTime())
    && date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0
}

/**
 * Converts a timestamp into the civil date used by the Brazilian operation.
 * Timestamps written by the old date input flow at 00:00 UTC are kept by their
 * UTC calendar date so an already edited proposal does not move back one day.
 */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  if (isLegacyDateOnlyTimestamp(iso)) return iso.slice(0, 10)

  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  const { year, month, day } = partsInBrazil(date)
  return `${year}-${month}-${day}`
}

/** Formats a timestamp as dd/mm/aaaa for proposal date displays. */
export function formatDateBr(iso: string | null | undefined): string {
  const value = toDateInputValue(iso)
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Serializes an input[type=date] without passing through local midnight.
 * Noon UTC remains the same civil date in the Mercurio operating timezone.
 */
export function dateInputToTimestamp(value: string | null | undefined): string {
  if (!value) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  return `${value}T12:00:00.000Z`
}

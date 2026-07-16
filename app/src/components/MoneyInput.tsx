import { useState } from 'react'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatReais(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

export function parseReaisInput(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  return digits ? Number(digits) / 100 : 0
}

export function MoneyInput({
  label, value, onChange, disabled, hint,
}: {
  label: string
  value: number
  onChange?: (value: number) => void
  disabled?: boolean
  hint?: string
}) {
  const [focused, setFocused] = useState(false)
  const display = value > 0 || focused ? formatReais(value) : ''

  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input font-medium"
        type="text"
        inputMode="numeric"
        value={display}
        disabled={disabled}
        placeholder="R$ 0,00"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={event => onChange?.(parseReaisInput(event.target.value))}
      />
      {hint && <p className="mt-1 text-xs text-silver-500">{hint}</p>}
    </div>
  )
}
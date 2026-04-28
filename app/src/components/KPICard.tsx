import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function KPICard({
  label,
  value,
  hint,
  intent = 'default',
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  intent?: 'default' | 'success' | 'warning' | 'danger' | 'gold'
  icon?: ReactNode
}) {
  const tone = {
    default: 'text-silver-900',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    gold: 'text-gold-600',
  }[intent]

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-silver-500">{label}</p>
          <p className={cn('mt-2 whitespace-nowrap text-[clamp(0.82rem,1.25vw,1.5rem)] font-bold leading-tight tabular-nums', tone)}>{value}</p>
          {hint && <p className="mt-1 text-xs text-silver-500">{hint}</p>}
        </div>
        {icon && <div className="shrink-0 text-silver-400">{icon}</div>}
      </div>
    </div>
  )
}

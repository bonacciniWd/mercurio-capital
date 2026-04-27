import { cn } from '@/lib/utils'

export function Logo({ className, variant = 'dark' }: { className?: string; variant?: 'dark' | 'light' }) {
  const text = variant === 'light' ? 'text-white' : 'text-navy'
  const accent = 'text-gold'
  return (
    <div className={cn('flex items-center gap-2 font-bold tracking-tight', className)}>
      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md bg-navy text-gold')}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M3 21V3l9 12L21 3v18h-3V11l-6 8-6-8v10H3z" />
        </svg>
      </span>
      <span className={cn('text-lg', text)}>
        Mercurio<span className={accent}>.</span>
      </span>
    </div>
  )
}

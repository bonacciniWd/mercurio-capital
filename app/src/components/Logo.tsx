import { cn } from '@/lib/utils'

const logoWide = new URL('../assets/logos/logowide.png', import.meta.url).href

export function Logo({ className, variant = 'dark' }: { className?: string; variant?: 'dark' | 'light' }) {
  const lightVariantClass = variant === 'light' ? 'brightness-0 invert' : ''

  return (
    <div className={cn('flex items-center gap-2 font-bold tracking-tight', className)}>
      <img src={logoWide} alt="Mercurio Capital" className={cn('h-20 w-auto', lightVariantClass)} />
    </div>
  )
}

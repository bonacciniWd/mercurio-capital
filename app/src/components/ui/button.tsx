import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'btn-no-liquid inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border border-red-700 bg-red-700 text-white hover:bg-red-800',
        secondary: 'border border-silver-200 bg-white text-silver-900 hover:bg-silver-50',
        outline: 'border border-silver-300 bg-white text-silver-700 hover:border-red-700/35 hover:bg-red-50 hover:text-silver-900',
        ghost: 'border border-transparent bg-transparent text-silver-600 hover:bg-silver-100 hover:text-silver-900',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3',
        lg: 'h-10 px-4',
        icon: 'h-9 w-9 px-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})

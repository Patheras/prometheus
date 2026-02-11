import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 before:absolute before:inset-0 before:bg-white/10 before:opacity-0 before:transition-opacity hover:before:opacity-100 active:before:opacity-20',
  {
    variants: {
      variant: {
        default:
          'bg-[#5E6AD2] text-white shadow-lg shadow-[#5E6AD2]/25 hover:shadow-xl hover:shadow-[#5E6AD2]/30 hover:bg-[#7C85E3]',
        secondary:
          'bg-white/[0.06] text-zinc-300 border border-white/[0.08] shadow-sm hover:bg-white/[0.1]',
        outline:
          'border-2 border-white/[0.12] bg-transparent hover:bg-white/[0.04] hover:text-zinc-100',
        ghost: 'hover:bg-white/[0.05] hover:text-white',
        destructive:
          'bg-rose-500 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 hover:bg-rose-600',
        link: 'text-[#5E6AD2] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2.5 text-sm rounded-xl',
        sm: 'h-9 px-4 py-2 text-xs rounded-lg',
        lg: 'h-12 px-8 py-3 text-base rounded-xl',
        icon: 'size-11 rounded-xl',
        'icon-sm': 'size-9 rounded-lg',
        'icon-lg': 'size-12 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }

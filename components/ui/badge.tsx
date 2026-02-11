import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all duration-150 overflow-hidden [a&]:hover:scale-105 [button&]:hover:scale-105',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#5E6AD2] text-white [a&]:hover:bg-[#7C85E3]',
        secondary:
          'border-white/[0.08] bg-white/[0.06] text-zinc-300 [a&]:hover:bg-white/[0.1] [a&]:hover:text-zinc-100',
        destructive:
          'border-transparent bg-rose-500/20 text-rose-400 [a&]:hover:bg-rose-500/30',
        success:
          'border-transparent bg-emerald-500/20 text-emerald-400 [a&]:hover:bg-emerald-500/30',
        warning:
          'border-transparent bg-amber-500/20 text-amber-400 [a&]:hover:bg-amber-500/30',
        outline:
          'border-white/[0.12] bg-transparent text-zinc-400 [a&]:hover:bg-white/[0.04] [a&]:hover:text-zinc-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

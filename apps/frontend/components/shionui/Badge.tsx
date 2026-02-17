import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        success: 'border-transparent bg-success text-success-foreground [a&]:hover:bg-success/90',
        warning: 'border-transparent bg-warning text-warning-foreground [a&]:hover:bg-warning/90',
        info: 'border-transparent bg-info text-info-foreground [a&]:hover:bg-info/90',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        neutral:
          'border border-neutral-300 text-foreground bg-background [a&]:hover:bg-neutral-100 dark:border-input dark:bg-input/30 dark:[a&]:hover:bg-input/50',
        outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[11px]',
        md: 'px-2 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
      shape: {
        rounded: '',
        circular: 'rounded-full px-0 py-0 min-w-[1.5em] h-[1.5em]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      shape: 'rounded',
    },
  },
)

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant']

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    content?: React.ReactNode
    containerClassName?: string
    offsetClassName?: string
  }

function Badge({
  className,
  containerClassName,
  offsetClassName,
  variant,
  size,
  shape,
  asChild = false,
  content,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : 'span'
  const shouldAnchor = content !== undefined && React.Children.count(children) > 0

  if (shouldAnchor) {
    return (
      <span className={cn('relative inline-flex w-fit', containerClassName)}>
        {children}
        <span
          data-slot="badge"
          className={cn(
            badgeVariants({ variant, size, shape }),
            'absolute -top-1 -right-1 translate-x-1/2 -translate-y-1/2',
            offsetClassName,
            className,
          )}
          {...props}
        >
          {content}
        </span>
      </span>
    )
  }

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, shape }), className)}
      {...props}
    >
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }

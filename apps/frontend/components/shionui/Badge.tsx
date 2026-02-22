import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      intent: {
        primary: '',
        secondary: '',
        success: '',
        warning: '',
        info: '',
        destructive: '',
        neutral: '',
      },
      appearance: {
        solid: '',
        soft: '',
        outline: '',
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
    compoundVariants: [
      // solid
      {
        intent: 'primary',
        appearance: 'solid',
        className: 'bg-primary text-primary-foreground border-transparent [a&]:hover:bg-primary/90',
      },
      {
        intent: 'secondary',
        appearance: 'solid',
        className:
          'bg-secondary text-secondary-foreground border-transparent [a&]:hover:bg-secondary/90',
      },
      {
        intent: 'success',
        appearance: 'solid',
        className: 'bg-success text-success-foreground border-transparent [a&]:hover:bg-success/90',
      },
      {
        intent: 'warning',
        appearance: 'solid',
        className: 'bg-warning text-warning-foreground border-transparent [a&]:hover:bg-warning/90',
      },
      {
        intent: 'info',
        appearance: 'solid',
        className: 'bg-info text-info-foreground border-transparent [a&]:hover:bg-info/90',
      },
      {
        intent: 'destructive',
        appearance: 'solid',
        className:
          'bg-destructive text-destructive-foreground border-transparent [a&]:hover:bg-destructive/90',
      },
      {
        intent: 'neutral',
        appearance: 'solid',
        className:
          'bg-neutral-800 text-white border-transparent dark:bg-neutral-200 dark:text-neutral-900',
      },

      // soft
      {
        intent: 'primary',
        appearance: 'soft',
        className: 'bg-primary/15 text-primary border-transparent [a&]:hover:bg-primary/25',
      },
      {
        intent: 'secondary',
        appearance: 'soft',
        className:
          'bg-secondary/25 text-secondary-foreground border-transparent [a&]:hover:bg-secondary/35',
      },
      {
        intent: 'success',
        appearance: 'soft',
        className: 'bg-success/15 text-success border-transparent [a&]:hover:bg-success/25',
      },
      {
        intent: 'warning',
        appearance: 'soft',
        className: 'bg-warning/15 text-warning border-transparent [a&]:hover:bg-warning/25',
      },
      {
        intent: 'info',
        appearance: 'soft',
        className: 'bg-info/15 text-info border-transparent [a&]:hover:bg-info/25',
      },
      {
        intent: 'destructive',
        appearance: 'soft',
        className:
          'bg-destructive/15 text-destructive border-transparent [a&]:hover:bg-destructive/25',
      },
      {
        intent: 'neutral',
        appearance: 'soft',
        className:
          'bg-neutral-100 text-foreground border-transparent dark:bg-input/30 [a&]:hover:bg-neutral-200 dark:[a&]:hover:bg-input/50',
      },

      // outline
      {
        intent: 'primary',
        appearance: 'outline',
        className: 'border-primary/30 text-primary bg-background [a&]:hover:bg-primary/10',
      },
      {
        intent: 'secondary',
        appearance: 'outline',
        className: 'border-border text-foreground bg-background [a&]:hover:bg-accent',
      },
      {
        intent: 'success',
        appearance: 'outline',
        className: 'border-success/30 text-success bg-background [a&]:hover:bg-success/10',
      },
      {
        intent: 'warning',
        appearance: 'outline',
        className: 'border-warning/30 text-warning bg-background [a&]:hover:bg-warning/10',
      },
      {
        intent: 'info',
        appearance: 'outline',
        className: 'border-info/30 text-info bg-background [a&]:hover:bg-info/10',
      },
      {
        intent: 'destructive',
        appearance: 'outline',
        className:
          'border-destructive/30 text-destructive bg-background [a&]:hover:bg-destructive/10',
      },
      {
        intent: 'neutral',
        appearance: 'outline',
        className:
          'border-neutral-300 text-foreground bg-background dark:border-input dark:bg-input/30 [a&]:hover:bg-neutral-100 dark:[a&]:hover:bg-input/50',
      },
    ],
    defaultVariants: {
      intent: 'primary',
      appearance: 'soft',
      size: 'md',
      shape: 'rounded',
    },
  },
)

export type BadgeVariant = VariantProps<typeof badgeVariants>['intent']
export type BadgeAppearance = VariantProps<typeof badgeVariants>['appearance']

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
  intent,
  appearance,
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
            badgeVariants({ intent, appearance, size, shape }),
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
      className={cn(badgeVariants({ intent, appearance, size, shape }), className)}
      {...props}
    >
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }

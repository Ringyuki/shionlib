import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/cn'

const shionAlertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
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
        outline: '',
        soft: '',
      },
      size: {
        sm: 'px-3 py-2 text-xs',
        default: 'px-4 py-3 text-sm',
        lg: 'px-5 py-4 text-base',
      },
    },
    compoundVariants: [
      // solid
      {
        intent: 'primary',
        appearance: 'solid',
        className:
          'bg-primary/15 text-primary border-primary/20 *:data-[slot=alert-description]:text-primary/90',
      },
      {
        intent: 'secondary',
        appearance: 'solid',
        className:
          'bg-secondary text-secondary-foreground border-secondary/20 *:data-[slot=alert-description]:text-secondary-foreground/90',
      },
      {
        intent: 'success',
        appearance: 'solid',
        className:
          'bg-success/15 text-success border-success/20 *:data-[slot=alert-description]:text-success/90',
      },
      {
        intent: 'warning',
        appearance: 'solid',
        className:
          'bg-warning/15 text-warning border-warning/20 *:data-[slot=alert-description]:text-warning/90',
      },
      {
        intent: 'info',
        appearance: 'solid',
        className:
          'bg-info/15 text-info border-info/20 *:data-[slot=alert-description]:text-info/90',
      },
      {
        intent: 'destructive',
        appearance: 'solid',
        className:
          'bg-destructive/10 text-destructive border-destructive/20 *:data-[slot=alert-description]:text-destructive/90',
      },
      {
        intent: 'neutral',
        appearance: 'solid',
        className:
          'bg-neutral-100 text-foreground border-neutral-200 dark:bg-input/30 dark:border-input',
      },

      // outline
      {
        intent: 'primary',
        appearance: 'outline',
        className:
          'bg-background border-primary/30 text-primary *:data-[slot=alert-description]:text-primary/90',
      },
      {
        intent: 'secondary',
        appearance: 'outline',
        className:
          'bg-background border-border text-foreground *:data-[slot=alert-description]:text-foreground/80',
      },
      {
        intent: 'success',
        appearance: 'outline',
        className:
          'bg-background border-success/30 text-success *:data-[slot=alert-description]:text-success/90',
      },
      {
        intent: 'warning',
        appearance: 'outline',
        className:
          'bg-background border-warning/30 text-warning *:data-[slot=alert-description]:text-warning/90',
      },
      {
        intent: 'info',
        appearance: 'outline',
        className:
          'bg-background border-info/30 text-info *:data-[slot=alert-description]:text-info/90',
      },
      {
        intent: 'destructive',
        appearance: 'outline',
        className:
          'bg-background border-destructive/30 text-destructive *:data-[slot=alert-description]:text-destructive/90',
      },
      {
        intent: 'neutral',
        appearance: 'outline',
        className:
          'bg-background border-neutral-300 text-foreground dark:border-input dark:bg-input/30',
      },

      // soft
      {
        intent: 'primary',
        appearance: 'soft',
        className:
          'bg-primary/10 text-primary border-transparent *:data-[slot=alert-description]:text-primary/90',
      },
      {
        intent: 'secondary',
        appearance: 'soft',
        className:
          'bg-secondary/25 text-secondary-foreground border-transparent *:data-[slot=alert-description]:text-foreground/80',
      },
      {
        intent: 'success',
        appearance: 'soft',
        className:
          'bg-success/10 text-success border-transparent *:data-[slot=alert-description]:text-success/90',
      },
      {
        intent: 'warning',
        appearance: 'soft',
        className:
          'bg-warning/10 text-warning border-transparent *:data-[slot=alert-description]:text-warning/90',
      },
      {
        intent: 'info',
        appearance: 'soft',
        className:
          'bg-info/10 text-info border-transparent *:data-[slot=alert-description]:text-info/90',
      },
      {
        intent: 'destructive',
        appearance: 'soft',
        className:
          'bg-destructive/10 text-destructive border-transparent *:data-[slot=alert-description]:text-destructive/90',
      },
      {
        intent: 'neutral',
        appearance: 'soft',
        className: 'bg-neutral-100 text-foreground border-transparent dark:bg-input/30',
      },
    ],
    defaultVariants: {
      intent: 'primary',
      appearance: 'soft',
      size: 'default',
    },
  },
)

type ShionAlertProps = React.ComponentProps<'div'> & VariantProps<typeof shionAlertVariants>

function Alert({ className, intent, appearance, size, ...props }: ShionAlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(shionAlertVariants({ intent, appearance, size }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-semibold tracking-tight', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, shionAlertVariants }

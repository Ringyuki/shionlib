'use client'

import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'

import { cn } from '@/utils/cn'

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  tone = 'default',
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  tone?: 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'info' | 'destructive'
}) {
  const toneClass =
    tone === 'muted'
      ? 'bg-muted'
      : tone === 'primary'
        ? 'bg-primary'
        : tone === 'success'
          ? 'bg-success'
          : tone === 'warning'
            ? 'bg-warning'
            : tone === 'info'
              ? 'bg-info'
              : tone === 'destructive'
                ? 'bg-destructive'
                : 'bg-border'
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        toneClass,
        'shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }

import { cn, Image, Text } from '@hina-ui/react'

type BrandProps = {
  className?: string
  collapsed?: boolean
}

export function BrandLogo({ className }: BrandProps) {
  return (
    <Image
      src="/brand/logo.png"
      alt=""
      eager
      lazy={false}
      skeleton={false}
      fit="contain"
      className={cn('size-8 shrink-0', className)}
    />
  )
}

export function Wordmark({ className, collapsed = false }: BrandProps) {
  return (
    <Text
      as="span"
      role="img"
      aria-label="Shionlib"
      aria-hidden={collapsed || undefined}
      data-collapsed={collapsed ? '' : undefined}
      className={cn(
        'text-accent block aspect-[4622/728] h-5 shrink-0 bg-current [mask:url(/brand/wordmark.svg)_center/contain_no-repeat]',
        className,
      )}
    />
  )
}

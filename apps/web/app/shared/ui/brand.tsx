import { cn, Image } from '@hina-ui/react'

type BrandProps = {
  className?: string
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

export function Wordmark({ className }: BrandProps) {
  return (
    <Image
      src="/brand/wordmark.svg"
      alt=""
      eager
      lazy={false}
      skeleton={false}
      fit="contain"
      className={cn('aspect-[4622/728] h-5 w-auto shrink-0', className)}
    />
  )
}

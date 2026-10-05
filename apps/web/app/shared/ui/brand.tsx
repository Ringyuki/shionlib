import { cn, Image } from '@hina-ui/react'
import { useLocale } from 'use-intl'

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

const wordmarks = {
  latin: { src: '/brand/wordmark.svg', ratio: 'aspect-[4892/874]' },
  chinese: { src: '/brand/wordmark-zh.svg', ratio: 'aspect-[5989/1038]' },
} as const

export function Wordmark({ className }: BrandProps) {
  const wordmark = wordmarks[useLocale() === 'zh' ? 'chinese' : 'latin']
  return (
    <Image
      src={wordmark.src}
      alt=""
      eager
      lazy={false}
      skeleton={false}
      fit="contain"
      className={cn(wordmark.ratio, 'h-5 w-auto shrink-0', className)}
    />
  )
}

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
  latin: {
    src: '/brand/wordmark.svg',
    ratio: 'aspect-[4892/874]',
    heights: { sm: 'h-4', md: 'h-5' },
  },
  chinese: {
    src: '/brand/wordmark-zh.svg',
    ratio: 'aspect-[5989/1038]',
    heights: { sm: 'h-5', md: 'h-6' },
  },
} as const

type WordmarkProps = BrandProps & {
  size?: 'sm' | 'md'
}

export function Wordmark({ size = 'md', className }: WordmarkProps) {
  const wordmark = wordmarks[useLocale() === 'zh' ? 'chinese' : 'latin']
  return (
    <Image
      src={wordmark.src}
      alt=""
      eager
      lazy={false}
      skeleton={false}
      fit="contain"
      className={cn(wordmark.ratio, wordmark.heights[size], 'w-auto shrink-0', className)}
    />
  )
}

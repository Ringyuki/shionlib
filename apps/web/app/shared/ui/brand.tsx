import { cn, Image } from '@hina-ui/react'
import { useLocale } from 'use-intl'
import LatinWordmark from './wordmark.svg?react'
import ChineseWordmark from './wordmark-zh.svg?react'

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
    Mark: LatinWordmark,
    ratio: 'aspect-[4892/874]',
    heights: { xs: 'h-3.5', sm: 'h-4', md: 'h-5' },
  },
  chinese: {
    Mark: ChineseWordmark,
    ratio: 'aspect-[5989/1038]',
    heights: { xs: 'h-4', sm: 'h-5', md: 'h-6' },
  },
} as const

type WordmarkProps = BrandProps & {
  size?: 'xs' | 'sm' | 'md'
  tone?: 'brand' | 'inherit'
}

export function Wordmark({ size = 'md', tone = 'brand', className }: WordmarkProps) {
  const { Mark, ratio, heights } = wordmarks[useLocale() === 'zh' ? 'chinese' : 'latin']
  return (
    <Mark
      aria-hidden
      focusable="false"
      className={cn(
        ratio,
        heights[size],
        'w-auto shrink-0',
        tone === 'brand' && 'text-accent',
        className,
      )}
    />
  )
}

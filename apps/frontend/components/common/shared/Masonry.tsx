'use client'

import useMasonry from '@/hooks/useMasonry'
import { cn } from '@/utils/cn'

interface ColumnCountBreakpoints {
  default: number
  sm: number
  md: number
  lg: number
}

const defaultColumnCountBreakpoints: ColumnCountBreakpoints = {
  default: 2,
  sm: 3,
  md: 4,
  lg: 5,
}

interface MasonryProps {
  children: React.ReactNode
  columnCountBreakpoints?: ColumnCountBreakpoints
  rowGap?: number
  className?: string
}

export const Masonry = ({
  children,
  columnCountBreakpoints = defaultColumnCountBreakpoints,
  rowGap = 6,
  className,
}: MasonryProps) => {
  const [masonryContainer, isInitialized] = useMasonry()

  return (
    <div
      ref={masonryContainer}
      data-initialized={isInitialized ? 'true' : 'false'}
      className={cn(
        'grid items-start',
        `grid-cols-${columnCountBreakpoints.default} sm:grid-cols-${columnCountBreakpoints.sm} md:grid-cols-${columnCountBreakpoints.md} lg:grid-cols-${columnCountBreakpoints.lg}`,
        `gap-${rowGap}`,
        'opacity-0 transition-opacity duration-200',
        isInitialized && 'opacity-100',
        className,
      )}
    >
      {children}
    </div>
  )
}

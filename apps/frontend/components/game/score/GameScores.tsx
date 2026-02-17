'use client'

import { BangumiScoreCard } from './Bangumi'
import { VNDBScoreCard } from './VNDB'
import { cn } from '@/utils/cn'

interface GameScoresProps {
  className?: string
  variant?: 'default' | 'overlay'
}

export const GameScores = ({ className, variant = 'default' }: GameScoresProps) => {
  return (
    <div className={cn('flex gap-2', className)}>
      <BangumiScoreCard variant={variant} />
      <VNDBScoreCard variant={variant} />
    </div>
  )
}

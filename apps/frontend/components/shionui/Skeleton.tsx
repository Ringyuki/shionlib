import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { cn } from '@/utils/cn'

type SkeletonOwnProps<E extends ElementType = 'div'> = {
  durationMs?: number
  angleDeg?: number
  tone?: 'neutral' | 'primary'
  as?: E
}

type SkeletonProps<E extends ElementType = 'div'> = SkeletonOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof SkeletonOwnProps>

const Skeleton = <E extends ElementType = 'div'>({
  as,
  className,
  style,
  durationMs = 1400,
  angleDeg = 100,
  tone = 'neutral',
  ...props
}: SkeletonProps<E>) => {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component
      data-slot="skeleton"
      className={cn(
        'skeleton rounded-md',
        tone === 'primary' ? 'skeleton-primary' : 'skeleton-neutral',
        className,
      )}
      style={{
        '--skeleton-duration': `${durationMs}ms`,
        '--skeleton-angle': `${angleDeg}deg`,
        ...style,
      }}
      {...props}
    />
  )
}

export { Skeleton }

'use client'

import { Masonry } from '@/components/common/shared/Masonry'
import { Card, CardContent } from '@/components/shionui/Card'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import type { ActivityFeedCategory } from './activities/constants/activity-feed'

interface ActivityLoadingSkeletonProps {
  category: ActivityFeedCategory
  count?: number
}

const metaWidthClasses = ['w-18', 'w-24', 'w-28', 'w-32', 'w-36'] as const
const shortLineWidthClasses = ['w-16', 'w-20', 'w-24', 'w-28', 'w-32'] as const
const titleWidthClasses = ['w-[58%]', 'w-[66%]', 'w-[74%]', 'w-[82%]', 'w-[90%]'] as const
const textWidthClasses = ['w-[42%]', 'w-[56%]', 'w-[68%]', 'w-[78%]', 'w-[88%]'] as const
const introWidthClasses = ['w-[60%]', 'w-[72%]', 'w-[84%]', 'w-[92%]'] as const

const pick = <T,>(items: readonly T[], seed: number, salt = 0) =>
  items[(seed * 7 + salt * 11) % items.length]

const getCount = (seed: number, min: number, max: number, salt = 0) =>
  min + ((seed * 5 + salt * 3) % (max - min + 1))

const getCommentBlockHeight = (seed: number) => 72 + ((seed * 19) % 72)

const ActivityMetaSkeleton = ({ seed, system = false }: { seed: number; system?: boolean }) => (
  <div className="flex items-center gap-2">
    {system ? (
      <Skeleton className="h-6 w-20 rounded-full" />
    ) : (
      <>
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className={cn('h-4 rounded-sm', pick(metaWidthClasses, seed, 1))} />
      </>
    )}
    <Skeleton className="ml-auto h-6 w-22 rounded-full" />
  </div>
)

const EmbeddedGameSkeleton = ({ seed }: { seed: number }) => {
  const introLineCount = getCount(seed, 1, 2, 2)

  return (
    <Card className="overflow-hidden border-border/60 bg-linear-to-br from-background/95 via-background/85 to-muted/40 p-0">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Skeleton className="aspect-3/4 w-16 shrink-0 rounded-md sm:w-18" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-10 rounded-sm" />
            <Skeleton className={cn('h-4 rounded-sm', pick(titleWidthClasses, seed, 3))} />
            {seed % 3 === 0 ? (
              <Skeleton className={cn('h-4 rounded-sm', pick(textWidthClasses, seed, 4))} />
            ) : null}
            {Array.from({ length: introLineCount }, (_, index) => (
              <Skeleton
                key={`embedded-intro-${seed}-${index}`}
                className={cn(
                  'h-3 rounded-sm',
                  pick(introWidthClasses, seed, index + 5),
                  index === introLineCount - 1 && 'max-w-[78%]',
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const CommentActivitySkeleton = ({ seed }: { seed: number }) => {
  const lineCount = getCount(seed, 3, 5, 6)

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-2 p-4">
        <ActivityMetaSkeleton seed={seed} />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-16 rounded-sm" />
          <Skeleton className="h-6 w-14 rounded-full" tone="primary" />
          <Skeleton className={cn('h-4 rounded-sm', pick(titleWidthClasses, seed, 7))} />
        </div>
        <div className="overflow-hidden rounded-lg border">
          <div
            className="flex flex-col gap-2 p-3"
            style={{ minHeight: `${getCommentBlockHeight(seed)}px` }}
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <Skeleton
                key={`comment-line-${seed}-${index}`}
                className={cn(
                  'h-3 rounded-sm',
                  pick(textWidthClasses, seed, index + 8),
                  index === lineCount - 1 && 'max-w-[64%]',
                )}
              />
            ))}
          </div>
        </div>
        <EmbeddedGameSkeleton seed={seed} />
      </CardContent>
    </Card>
  )
}

const CreateActivitySkeleton = ({ seed }: { seed: number }) => (
  <Card className="py-0">
    <CardContent className="flex flex-col gap-3 p-4">
      <ActivityMetaSkeleton seed={seed} />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-4 w-18 rounded-sm" />
        <Skeleton className="h-6 w-16 rounded-full" tone="primary" />
        <Skeleton className={cn('h-4 rounded-sm', pick(titleWidthClasses, seed, 9))} />
      </div>
      <EmbeddedGameSkeleton seed={seed + 1} />
    </CardContent>
  </Card>
)

const WalkthroughActivitySkeleton = ({ seed }: { seed: number }) => (
  <Card className="py-0">
    <CardContent className="flex flex-col gap-3 p-4">
      <ActivityMetaSkeleton seed={seed} />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-4 w-20 rounded-sm" />
        <Skeleton className="h-6 w-16 rounded-full" tone="primary" />
        <Skeleton className={cn('h-4 rounded-sm', pick(titleWidthClasses, seed, 10))} />
        <Skeleton className="h-4 w-14 rounded-sm" />
        <Skeleton className={cn('h-4 rounded-sm', pick(textWidthClasses, seed, 11))} />
      </div>
      <EmbeddedGameSkeleton seed={seed + 2} />
    </CardContent>
  </Card>
)

const EditActivitySkeleton = ({ seed }: { seed: number }) => {
  const showEmbeddedGame = seed % 3 === 0

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-3 p-4">
        <ActivityMetaSkeleton seed={seed} />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-16 rounded-sm" />
          <Skeleton className="h-6 w-18 rounded-full" tone="primary" />
          <Skeleton className={cn('h-4 rounded-sm', pick(titleWidthClasses, seed, 12))} />
        </div>
        {showEmbeddedGame ? <EmbeddedGameSkeleton seed={seed + 3} /> : null}
      </CardContent>
    </Card>
  )
}

const FileProgressActivitySkeleton = ({ seed }: { seed: number }) => {
  const timelineCount = getCount(seed, 3, 5, 13)

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-4 p-4">
        <EmbeddedGameSkeleton seed={seed + 4} />

        <div className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className={cn('h-4 rounded-sm', pick(titleWidthClasses, seed, 14))} />
            <Skeleton className="h-3 w-18 rounded-sm" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={`stage-${seed}-${index}`} className="flex items-center gap-1">
                  <Skeleton className="size-3.5 rounded-full" />
                  <Skeleton
                    className={cn('h-3 rounded-sm', pick(shortLineWidthClasses, seed, index + 15))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20 rounded-sm" />
          <div className="space-y-2">
            {Array.from({ length: timelineCount }, (_, index) => (
              <div key={`timeline-${seed}-${index}`} className="flex items-center gap-3">
                <Skeleton
                  className={cn('h-6 rounded-full', pick(shortLineWidthClasses, seed, index + 18))}
                />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton
                    className={cn('h-3 rounded-sm', pick(textWidthClasses, seed, index + 21))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const ActivitySkeletonCard = ({
  category,
  seed,
}: {
  category: ActivityFeedCategory
  seed: number
}) => {
  switch (category) {
    case 'comments':
      return <CommentActivitySkeleton seed={seed} />
    case 'gameCreates':
      return <CreateActivitySkeleton seed={seed} />
    case 'walkthroughCreates':
      return <WalkthroughActivitySkeleton seed={seed} />
    case 'edits':
      return <EditActivitySkeleton seed={seed} />
    case 'files':
      return <FileProgressActivitySkeleton seed={seed} />
  }
}

export const ActivityLoadingSkeleton = ({ category, count = 10 }: ActivityLoadingSkeletonProps) => {
  return (
    <Masonry columnCountBreakpoints={{ default: 1, sm: 2, md: 2, lg: 2 }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={`activity-skeleton-${category}-${index}`} className="break-inside-avoid">
          <ActivitySkeletonCard category={category} seed={index + 1} />
        </div>
      ))}
    </Masonry>
  )
}

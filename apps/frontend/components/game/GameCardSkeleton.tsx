import { Card } from '@/components/shionui/Card'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'

interface GameCardSkeletonProps {
  seed?: number
}

const coverVariants = [
  {
    shellClassName: 'w-auto h-full',
    coverClassName: 'h-full aspect-[1/1.5]',
  },
  {
    shellClassName: 'w-full h-auto',
    coverClassName: 'w-full aspect-square',
  },
  {
    shellClassName: 'w-full h-auto',
    coverClassName: 'w-full aspect-[1.5/1]',
  },
] as const

const getCoverVariant = (seed: number) => coverVariants[(seed * 5 + 1) % coverVariants.length]
const singleLineWidths = ['w-[92%]', 'w-[84%]', 'w-[78%]', 'w-[88%]', 'w-[72%]'] as const
const secondLineWidths = ['w-[66%]', 'w-[58%]', 'w-[62%]', 'w-[54%]', 'w-[70%]'] as const

const getTitleLines = (seed: number) => {
  const isTwoLines = seed % 5 === 0
  if (!isTwoLines) {
    return [{ widthClassName: singleLineWidths[(seed * 3 + 2) % singleLineWidths.length] }]
  }

  return [
    { widthClassName: 'w-full' },
    { widthClassName: secondLineWidths[(seed * 7 + 1) % secondLineWidths.length] },
  ]
}

export const GameCardSkeleton = ({ seed = 0 }: GameCardSkeletonProps) => {
  const variant = getCoverVariant(seed)
  const titleLines = getTitleLines(seed)

  return (
    <Card className="relative aspect-3/4 overflow-hidden border-0 bg-muted p-0">
      <div className="absolute inset-0 overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none scale-110 opacity-75" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-3 pb-16">
        <div
          className={cn(
            'relative max-h-full max-w-full overflow-hidden rounded-lg',
            variant.shellClassName,
          )}
        >
          <Skeleton className={cn('rounded-lg', variant.coverClassName)} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/20 via-black/10 dark:via-black/20 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex flex-col gap-1.5">
          {titleLines.map((line, index) => (
            <Skeleton
              key={`${seed}-${index}`}
              className={cn(
                'h-5 rounded-sm',
                index === 0 ? 'bg-white/70' : 'bg-white/60',
                line.widthClassName,
              )}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}

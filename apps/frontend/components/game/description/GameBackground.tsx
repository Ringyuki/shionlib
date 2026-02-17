import { FadeImage } from '@/components/common/shared/FadeImage'
import { GameHeader } from '@/interfaces/game/game.interface'
import { cn } from '@/utils/cn'

interface GameBackgroundProps {
  game: GameHeader
  title: string
}

export const GameBackground = ({ game, title }: GameBackgroundProps) => {
  const img = game.covers?.[0]
  const url = img?.url
  const sexual = img?.sexual
  const violence = img?.violence
  if (!url) return null
  return (
    <div className="fixed top-0 right-[var(--removed-body-scroll-bar-size,0px)] w-dvw h-dvh z-[-1]">
      <FadeImage
        src={url}
        alt={title}
        className={cn(
          'w-full h-full opacity-16 blur-sm',
          ((sexual && sexual >= 1) || (violence && violence >= 1)) && 'blur-3xl',
        )}
        imageClassName="object-cover"
        showSkeleton={false}
      />
    </div>
  )
}

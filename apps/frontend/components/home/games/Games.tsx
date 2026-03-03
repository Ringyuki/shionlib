import { GameItem } from '@/interfaces/game/game.interface'
import { GameCard } from '@/components/game/GameCard'
import { GameCardSkeleton } from '@/components/game/GameCardSkeleton'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface GamesProps {
  games: GameItem[]
  content_limit: ContentLimit
  loading?: boolean
  skeletonCount?: number
  lastItemRef?: (node: HTMLDivElement | null) => void
}

export const Games = ({
  games,
  content_limit,
  loading = false,
  skeletonCount = 4,
  lastItemRef,
}: GamesProps) => {
  return (
    <div className="game-grid">
      {games.map((game, index) => (
        <div key={game.id} ref={index === games.length - 1 ? lastItemRef : undefined}>
          <GameCard game={game} content_limit={content_limit} />
        </div>
      ))}
      {loading
        ? Array.from({ length: skeletonCount }, (_, index) => (
            <GameCardSkeleton key={`game-skeleton-${index}`} seed={games.length + index} />
          ))
        : null}
    </div>
  )
}

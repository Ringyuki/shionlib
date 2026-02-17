import { GameItem } from '@/interfaces/game/game.interface'

import { GameCard } from '@/components/game/GameCard'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface RecentUpdatesProps {
  recentUpdates: GameItem[]
  content_limit: ContentLimit
}

export const RecentUpdates = ({ recentUpdates, content_limit }: RecentUpdatesProps) => {
  return (
    <div className="game-grid">
      {recentUpdates.map(game => (
        <GameCard key={game.id} game={game} content_limit={content_limit} />
      ))}
    </div>
  )
}

import { GameItem } from '@/interfaces/game/game.interface'

import { GameCard } from '@/components/game/GameCard'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface GamesProps {
  games: GameItem[]
  content_limit: ContentLimit
}

export const Games = ({ games, content_limit }: GamesProps) => {
  return (
    <div className="game-grid">
      {games.map(game => (
        <GameCard key={game.id} game={game} content_limit={content_limit} />
      ))}
    </div>
  )
}

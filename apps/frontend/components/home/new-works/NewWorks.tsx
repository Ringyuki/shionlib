import { GameItem } from '@/interfaces/game/game.interface'

import { GameCard } from '@/components/game/GameCard'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface NewWorksProps {
  newWorks: GameItem[]
  content_limit: ContentLimit
}

export const NewWorks = ({ newWorks, content_limit }: NewWorksProps) => {
  return (
    <div className="game-grid">
      {newWorks.map(game => (
        <GameCard key={game.id} game={game} content_limit={content_limit} />
      ))}
    </div>
  )
}

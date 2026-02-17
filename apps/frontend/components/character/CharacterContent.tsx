import { GameCharacter, GameItem } from '@/interfaces/game/game.interface'
import { CharacterIntro } from './intros/CharacterIntro'
import { GameCard } from '@/components/game/GameCard'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { Pagination } from '../common/content/Pagination'
import { Empty } from '../common/content/Empty'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface CharacterContentProps {
  character: GameCharacter
  games: GameItem[]
  meta: PaginatedMeta
  appearances_count: number
  content_limit: ContentLimit
}

export const CharacterContent = ({
  character,
  games,
  meta,
  appearances_count,
  content_limit,
}: CharacterContentProps) => {
  return (
    <div className="flex flex-col gap-8">
      <CharacterIntro character={character} appearances_count={appearances_count} />
      {games.length > 0 ? (
        <>
          <div className="game-grid">
            {games.map(game => (
              <GameCard key={game.id} game={game} content_limit={content_limit} />
            ))}
          </div>
          <Pagination currentPage={meta.currentPage} totalPages={meta.totalPages} />
        </>
      ) : (
        <Empty />
      )}
    </div>
  )
}

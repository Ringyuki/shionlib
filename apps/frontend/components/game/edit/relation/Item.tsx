import { GameRelation } from '@/interfaces/game/game.interface'
import { GameEmbeddedCard } from '@/components/game/GameEmbeddedCard'

interface RelationItemProps {
  relation: GameRelation
  onClick?: () => void
}

export const RelationItem = ({ relation, onClick }: RelationItemProps) => {
  return (
    <div className="relative cursor-pointer group" onClick={onClick}>
      <GameEmbeddedCard game={relation.to_game} asLink={false} />
    </div>
  )
}

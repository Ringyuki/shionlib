import { GameCharacterItem } from './GameCharacterItem'
import { GameCharacterRelation, GameCharacterRole } from '@/interfaces/game/game.interface'
import { Empty } from '@/components/common/content/Empty'
import { useTranslations } from 'next-intl'

interface GameCharacterProps {
  characters: GameCharacterRelation[]
}

export const GameCharacter = ({ characters }: GameCharacterProps) => {
  const t = useTranslations('Components.Game.Description.GameCharacter')
  const priority: Record<GameCharacterRole, number> = {
    main: 0,
    primary: 1,
    side: 2,
    appears: 3,
  }
  const sorted = [...characters].sort((a, b) => {
    const aPriority = a.role ? priority[a.role] : 4
    const bPriority = b.role ? priority[b.role] : 4
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.character.id - b.character.id
  })

  return (
    <div className="flex flex-col gap-4 w-full">
      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
          {sorted.map(character => (
            <GameCharacterItem key={character.character.id} character={character} />
          ))}
        </div>
      ) : (
        <Empty title={t('noCharacters')} />
      )}
    </div>
  )
}

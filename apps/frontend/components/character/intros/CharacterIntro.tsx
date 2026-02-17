import { GameCharacter } from '@/interfaces/game/game.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { BasicInfos } from './BasicInfos'
import { Details } from './Details'
import { CharacterActions } from '../actions/CharacterActions'

interface CharacterIntroProps {
  character: GameCharacter
  appearances_count: number
}

export const CharacterIntro = ({ character, appearances_count }: CharacterIntroProps) => {
  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <BasicInfos character={character} appearances_count={appearances_count} />
          <Details character={character} />
          <CharacterActions character_id={character.id} />
        </div>
      </CardContent>
    </Card>
  )
}

import { GameCharacter } from '@/components/game/description/GameCharacter'
import { shionlibRequest } from '@/utils/request'
import { GameData } from '@/interfaces/game/game.interface'

interface CharactersPageProps {
  params: Promise<{ id: string }>
}

export default async function CharactersPage({ params }: CharactersPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<{ characters: GameData['characters'] }>(
    `/game/${id}/characters`,
  )
  return <GameCharacter characters={data.data?.characters ?? []} />
}

import { Character } from '@/components/game/edit/Character'
import { shionlibRequest } from '@/utils/request'
import { GameCharacterRelation } from '@/interfaces/game/game.interface'

interface CharacterPageProps {
  params: Promise<{ id: number }>
}

export default async function GameCharacterEditPage({ params }: CharacterPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<GameCharacterRelation[]>(`/edit/game/${id}/characters`)

  return <Character initRelations={data?.data ?? []} id={id} />
}

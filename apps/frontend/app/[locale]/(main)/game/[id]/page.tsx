import { shionlibRequest } from '@/utils/request'
import { GameDetail as GameDetailType } from '@/interfaces/game/game.interface'
import { GameDetail } from '@/components/game/description/GameDetail'

interface GamePageProps {
  params: Promise<{ id: string }>
}

export default async function GamePage({ params }: GamePageProps) {
  const { id } = await params
  const game = await shionlibRequest().get<GameDetailType>(`/game/${id}/details`)

  return <GameDetail game={game.data!} />
}

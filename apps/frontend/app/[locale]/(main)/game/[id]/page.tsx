import { shionlibRequest } from '@/utils/request'
import { GameDetail as GameDetailType, GameData } from '@/interfaces/game/game.interface'
import { GameDetail } from '@/components/game/description/GameDetail'
import { PVNBindingInfo } from '@/interfaces/potatovn/potatovn-binding.interface'
import { PvnGameData } from '@/interfaces/potatovn/pvn-game-data.interface'
import { GamePVNSection } from '@/components/game/pvn/GamePVNSection'

interface GamePageProps {
  params: Promise<{ id: string }>
}

export default async function GamePage({ params }: GamePageProps) {
  const { id } = await params
  const [game, me, gameHeader] = await Promise.all([
    shionlibRequest().get<GameDetailType>(`/game/${id}/details`),
    shionlibRequest({ forceNotThrowError: true }).get('/user/me'),
    shionlibRequest({ forceNotThrowError: true }).get<GameData>(`/game/${id}/header`),
  ])
  let pvnGameData: PvnGameData | null = null
  let binding = false

  if (me.data) {
    const [pvnBindingRes, pvnGameRes] = await Promise.all([
      shionlibRequest({ forceNotThrowError: true }).get<PVNBindingInfo>('/potatovn/binding'),
      shionlibRequest({ forceNotThrowError: true }).get<PvnGameData>(`/potatovn/game/${id}`),
    ])
    binding = !!pvnBindingRes.data
    pvnGameData = pvnGameRes.data ?? null
  }

  return (
    <>
      {binding && (
        <GamePVNSection
          gameId={Number(id)}
          initialData={pvnGameData}
          cover={gameHeader.data?.covers?.[0]}
        />
      )}
      <GameDetail game={game.data!} />
    </>
  )
}

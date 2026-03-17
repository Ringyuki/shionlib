import { LinkEdit } from '@/components/game/edit/Link'
import { shionlibRequest } from '@/utils/request'
import { GameLink } from '@/interfaces/game/game.interface'

interface LinkPageProps {
  params: Promise<{ id: number }>
}

export default async function GameLinkEditPage({ params }: LinkPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<GameLink[]>(`/edit/game/${id}/links`)

  return <LinkEdit initLinks={data?.data ?? []} id={id} />
}

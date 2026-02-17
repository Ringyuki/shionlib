import { Cover } from '@/components/game/edit/Cover'
import { shionlibRequest } from '@/utils/request'
import { GameCover } from '@/interfaces/game/game.interface'

interface CoverPageProps {
  params: Promise<{ id: string }>
}

export default async function CoverPage({ params }: CoverPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<GameCover[]>(`/edit/game/${id}/cover`)

  return <Cover covers={data?.data ?? []} />
}

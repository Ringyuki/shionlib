import { Developer } from '@/components/game/edit/Developer'
import { shionlibRequest } from '@/utils/request'
import { DeveloperRelation } from '@/interfaces/game/game.interface'

interface DeveloperPageProps {
  params: Promise<{ id: number }>
}

export default async function GameDeveloperEditPage({ params }: DeveloperPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<DeveloperRelation[]>(`/edit/game/${id}/developers`)

  return <Developer initRelations={data?.data ?? []} id={id} />
}

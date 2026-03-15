import { Relation } from '@/components/game/edit/Relation'
import { shionlibRequest } from '@/utils/request'
import { GameRelation } from '@/interfaces/game/game.interface'

interface RelationPageProps {
  params: Promise<{ id: number }>
}

export default async function GameRelationEditPage({ params }: RelationPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<GameRelation[]>(`/edit/game/${id}/relations`)

  return <Relation initRelations={data?.data ?? []} id={id} />
}

import { Scalar } from '@/components/game/edit/Scalar'
import { shionlibRequest } from '@/utils/request'
import { GameScalar } from '@/interfaces/edit/scalar.interface'

interface ScalarPageProps {
  params: Promise<{ id: string }>
}

export default async function ScalarPage({ params }: ScalarPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<GameScalar>(`/edit/game/${id}/scalar`)

  return <Scalar data={data.data!} />
}

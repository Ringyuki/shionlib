import { CharacterScalarEdit } from '@/components/character/edit/Scalar'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'
import { shionlibRequest } from '@/utils/request'

interface ScalarPageProps {
  params: Promise<{ id: string }>
}

export default async function CharacterScalarEditPage({ params }: ScalarPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<CharacterScalar>(`/edit/character/${id}/scalar`)

  return <CharacterScalarEdit data={data.data!} />
}

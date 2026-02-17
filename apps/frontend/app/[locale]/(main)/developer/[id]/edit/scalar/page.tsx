import { DeveloperScalarEdit } from '@/components/developer/edit/Scalar'
import { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'
import { shionlibRequest } from '@/utils/request'

interface ScalarPageProps {
  params: Promise<{ id: string }>
}

export default async function DeveloperScalarEditPage({ params }: ScalarPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<DeveloperScalar>(`/edit/developer/${id}/scalar`)

  return <DeveloperScalarEdit data={data.data!} />
}

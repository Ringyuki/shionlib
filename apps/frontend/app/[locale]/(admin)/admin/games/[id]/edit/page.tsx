import { notFound } from 'next/navigation'
import { shionlibRequest } from '@/utils/request'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { AdminGameScalarEditor } from '@/components/admin/games/AdminGameScalarEditor'

interface AdminGameEditPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminGameEditPage({ params }: AdminGameEditPageProps) {
  const { id } = await params
  const gameId = Number(id)
  if (!Number.isInteger(gameId) || gameId <= 0) {
    notFound()
  }

  const data = await shionlibRequest({ forceNotThrowError: true }).get<GameScalar>(
    `/admin/content/games/${gameId}/edit/scalar`,
  )
  if (!data.data) {
    notFound()
  }

  return <AdminGameScalarEditor gameId={gameId} data={data.data} />
}

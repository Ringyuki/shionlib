import { shionlibRequest } from '@/utils/request'
import { Walkthrough, WalkthroughStatus } from '@/interfaces/walkthrough/walkthrough.interface'
import { notFound } from 'next/navigation'
import { WalkthroughDetail } from '@/components/game/walkthrough/Detail'

interface WalkthroughDetailPageProps {
  params: Promise<{ id: string; walkthrough_id: string }>
}

export default async function WalkthroughDetailPage({ params }: WalkthroughDetailPageProps) {
  const { id, walkthrough_id } = await params

  const { data: walkthrough } = await shionlibRequest({
    forceNotThrowError: true,
  }).get<Walkthrough>(`/walkthrough/${walkthrough_id}`)

  if (!walkthrough || walkthrough.status === WalkthroughStatus.DELETED) {
    notFound()
  }

  return <WalkthroughDetail walkthrough={walkthrough} gameId={id} />
}

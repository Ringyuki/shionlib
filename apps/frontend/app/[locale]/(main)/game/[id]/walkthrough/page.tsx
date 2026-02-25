import { GameWalkthrough } from '@/components/game/walkthrough/GameWalkthrough'
import { shionlibRequest } from '@/utils/request'
import { Walkthrough } from '@/interfaces/walkthrough/walkthrough.interface'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'

interface WalkthroughPageProps {
  params: Promise<{ id: string }>
}

export default async function WalkthroughPage({ params }: WalkthroughPageProps) {
  const { id } = await params
  const { data: walkthroughs } = await shionlibRequest().get<PaginatedResponse<Walkthrough>>(
    `/walkthrough/game/${id}`,
  )
  return <GameWalkthrough walkthroughs={walkthroughs?.items ?? []} gameId={id} />
}

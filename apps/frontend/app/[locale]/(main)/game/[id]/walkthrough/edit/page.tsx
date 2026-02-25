import { GameWalkthroughEdit } from '@/components/game/walkthrough/edit/Edit'
import { shionlibRequest } from '@/utils/request'
import { Walkthrough } from '@/interfaces/walkthrough/walkthrough.interface'

interface GameWalkthroughEditPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ walkthrough_id: string | undefined }>
}

export default async function GameWalkthroughEditPage({
  params,
  searchParams,
}: GameWalkthroughEditPageProps) {
  const { id } = await params
  const { walkthrough_id } = await searchParams

  const walkthrough = walkthrough_id
    ? ((
        await shionlibRequest({ forceNotThrowError: true }).get<Walkthrough>(
          `/walkthrough/${walkthrough_id}`,
          { params: { withContent: 'true' } },
        )
      ).data ?? undefined)
    : undefined

  return <GameWalkthroughEdit walkthrough={walkthrough} gameId={id} />
}

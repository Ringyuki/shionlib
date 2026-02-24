import { GameWalkthrough } from '@/components/game/walkthrough/GameWalkthrough'

interface WalkthroughPageProps {
  params: Promise<{ id: string }>
}

export default async function WalkthroughPage({ params }: WalkthroughPageProps) {
  const { id } = await params
  return <GameWalkthrough />
}

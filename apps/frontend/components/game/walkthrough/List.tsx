import { Walkthrough } from '@/interfaces/walkthrough/walkthrough.interface'
import { GameWalkthroughItem } from './Item'

interface GameWalkthroughListProps {
  walkthroughs: Walkthrough[]
  gameId: string
}

export const GameWalkthroughList = ({ walkthroughs, gameId }: GameWalkthroughListProps) => {
  return (
    <div className="flex flex-col gap-4 min-h-128">
      {walkthroughs.map(walkthrough => (
        <GameWalkthroughItem key={walkthrough.id} walkthrough={walkthrough} gameId={gameId} />
      ))}
    </div>
  )
}

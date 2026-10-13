import { primaryCover, type GameHeader } from '../game'
import { GamePicture } from './game-picture'

type GameCoverProps = {
  game: Pick<GameHeader, 'covers'>
  className?: string
}

export function GameCover({ game, className }: GameCoverProps) {
  return (
    <GamePicture picture={primaryCover(game)} ratio={3 / 4} fit="cover" className={className} />
  )
}

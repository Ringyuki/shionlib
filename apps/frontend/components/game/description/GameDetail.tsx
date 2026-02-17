'use client'

import { GameDetail as GameDetailType } from '@/interfaces/game/game.interface'
import { GameDescription } from './GameDescription'
import { GameImages } from './GameImages'
import { GameTags } from './GameTags'
import { GameStaff } from './GameStaff'
import { GameExtraInfo } from './GameExtraInfo'
import { GameLinks } from './GameLinks'

interface GameDetailProps {
  game: GameDetailType
}

export const GameDetail = ({ game }: GameDetailProps) => {
  return (
    <div className="flex flex-col gap-8">
      <GameTags tags={game.tags} />
      <GameDescription game={game} />
      <GameImages images={game.images} content_limit={game.content_limit} />
      <GameStaff staffs={game.staffs} />
      <GameExtraInfo extra_info={game.extra_info} />
      <GameLinks link={game.link} />
    </div>
  )
}

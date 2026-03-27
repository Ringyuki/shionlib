'use client'

import { GameDetail as GameDetailType } from '@/interfaces/game/game.interface'
import { GameDescription } from './GameDescription'
import { GameImages } from './GameImages'
import { GameTags } from './GameTags'
import { GameStaff } from './GameStaff'
import { GameExtraInfo } from './GameExtraInfo'
import { GameLinks } from './GameLinks'
import { GameRelations } from './GameRelations'
import { GameSteamWidget } from './GameSteamWidget'

interface GameDetailProps {
  game: GameDetailType
}

export const GameDetail = ({ game }: GameDetailProps) => {
  return (
    <div className="flex flex-col gap-4">
      <GameSteamWidget link={game.link} />
      <GameRelations relations={game.relations_from ?? []} content_limit={game.content_limit} />
      <GameTags tags={game.tags} />
      <GameDescription game={game} />
      <GameImages images={game.images} content_limit={game.content_limit} />
      <GameStaff staffs={game.staffs} />
      <GameExtraInfo extra_info={game.extra_info} />
      <GameLinks link={game.link} />
    </div>
  )
}

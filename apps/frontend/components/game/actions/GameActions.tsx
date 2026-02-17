'use client'

import { GameHeader } from '@/interfaces/game/game.interface'
import { Separator } from '@/components/shionui/Separator'
import { Download } from './Download'
import { Upload } from './Upload'
import { Comment } from './Comment'
import { Favorite } from './Favorite'
import { Edit } from './Edit'
import { History } from './History'
import { Patch } from './Patch'
import { MoreActions } from './more/MoreActions'
import { useShionlibUserStore } from '@/store/userStore'
import { UserRole } from '@/interfaces/user/user.interface'

interface GameActionsProps {
  game: GameHeader
  is_favorite: boolean
}

export const GameActions = ({ game, is_favorite }: GameActionsProps) => {
  const user = useShionlibUserStore(state => state.user)
  const isAdmin = user.role >= UserRole.ADMIN
  return (
    <>
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-2 md:items-center flex-col md:flex-row items-start">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex gap-2 items-center">
              <Download game_id={game.id} />
              <Patch game_id={game.id} v_id={game.v_id!} />
              <Upload game_id={game.id} />
            </div>
            <div className="flex gap-2 items-center">
              <Edit game_id={game.id} />
              <History game_id={game.id} />
              <Favorite isFavorite={is_favorite} gameId={game.id} className="lg:hidden flex" />
              <Comment className="lg:hidden flex" gameId={game.id} />
            </div>
          </div>
          <div className="lg:flex hidden items-center gap-2">
            <Separator orientation="vertical" className="h-4! hidden md:block" />
            <Favorite isFavorite={is_favorite} gameId={game.id} />
            <Comment gameId={game.id} />
            {isAdmin && <MoreActions game_id={game.id} />}
          </div>
        </div>
      </div>
    </>
  )
}

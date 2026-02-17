import { GameHeader as GameHeaderType } from '@/interfaces/game/game.interface'
import { Separator } from '@/components/shionui/Separator'
import { GameTitle } from './GameTitle'
import { GameDeveloper } from './GameDeveloper'
import { GamePlatform } from './GamePlatform'
import { GameReleaseTime } from './GameReleaseTime'
import { GameActions } from '../actions/GameActions'
import { getPreferredContent } from './helpers/getPreferredContent'
import { GameCover } from '../cover/GameCover'
import { getLocale } from 'next-intl/server'
import { GameScores } from '../score/GameScores'
import { GameBackground } from './GameBackground'
import { shionlibRequest } from '@/utils/request'

interface GameHeaderProps {
  game: GameHeaderType
}

const getFavoriteStatus = async (game_id: number) => {
  const data = await shionlibRequest({ forceNotThrowError: true }).get<{ is_favorite: boolean }>(
    `/favorites/game/${game_id}/stats`,
  )
  return data.data?.is_favorite ?? false
}

export const GameHeader = async ({ game }: GameHeaderProps) => {
  const locale = await getLocale()
  const is_favorite = await getFavoriteStatus(game.id)

  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'

  const { title } = getPreferredContent(game, 'title', lang)
  const all_titles = [game.title_jp, game.title_zh, game.title_en]
  const excess_titles = all_titles.filter(t => t !== title).filter(t => !!t)

  const { cover, vertical, aspect } = getPreferredContent(game, 'cover', lang)
  return (
    <div className="flex flex-col lg:flex-row overflow-hidden lg:gap-4 gap-2 shadow-content-strong bg-card-soft w-full rounded-md items-center">
      <GameBackground game={game} title={title} />
      <div className="relative w-full lg:w-fit">
        <GameCover
          covers={game.covers ?? []}
          preferredCoverInfo={{ cover, vertical, aspect }}
          title={title}
          content_limit={game.content_limit}
        />
        {aspect === '1.5 / 1' && (
          <div className="absolute bottom-2 left-2 hidden lg:block">
            <GameScores variant="overlay" />
          </div>
        )}
      </div>
      <div className="p-4 pt-2 lg:p-6 lg:pl-2 flex flex-1 h-auto justify-between gap-2 flex-col w-full">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <GameTitle
              title={title}
              excess_titles={excess_titles}
              aliases={game.aliases}
              type={game.type}
            />
            {(aspect === '1 / 1.5' || aspect === '1 / 1') && (
              <GameScores className="hidden lg:flex" />
            )}
          </div>
          <div className="flex gap-8 lg:mt-2 flex-wrap items-center">
            <GameDeveloper developers={game.developers} />
            <GameReleaseTime
              release_date={game.release_date}
              release_date_tba={game.release_date_tba}
            />
          </div>
          <GamePlatform platform={game.platform} className="lg:mt-2" />
        </div>
        <GameScores className="flex lg:hidden justify-start w-full lg:mt-2" variant="overlay" />
        <Separator />
        <GameActions game={game} is_favorite={is_favorite} />
      </div>
    </div>
  )
}

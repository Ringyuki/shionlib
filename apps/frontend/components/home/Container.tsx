import { Head as NewWorksHead } from './new-works/Head'
import { GameItem } from '@/interfaces/game/game.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Ad } from '@/components/common/site/Ad'
import { NewWorks } from './new-works/NewWorks'
import { RecentUpdates } from './recent-update/RecentUpdates'
import { Head as RecentUpdateHead } from './recent-update/Head'
import { Hero } from './hero/Hero'
import { Hot } from './hot/Hot'

interface ContainerProps {
  hotGames: GameItem[]
  hotMeta: PaginatedMeta
  content_limit: ContentLimit
  newWorks: GameItem[]
  recentUpdates: GameItem[]
}

export const Container = ({
  hotGames,
  hotMeta,
  content_limit,
  newWorks,
  recentUpdates,
}: ContainerProps) => {
  return (
    <div className="flex flex-col gap-8">
      <Hero />
      <div className="flex flex-col gap-6">
        <NewWorksHead />
        <NewWorks newWorks={newWorks} content_limit={content_limit} />
      </div>
      <Ad id={4} />
      {recentUpdates.length > 0 && (
        <div className="flex flex-col gap-6">
          <RecentUpdateHead />
          <RecentUpdates recentUpdates={recentUpdates} content_limit={content_limit} />
        </div>
      )}
      <Ad id={1} />
      <Hot hotGames={hotGames} content_limit={content_limit} initialMeta={hotMeta} />
      <Ad id={1} />
    </div>
  )
}

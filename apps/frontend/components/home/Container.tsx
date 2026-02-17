import { Activity } from './activity/Activity'
import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import { Head as ActivityHead } from './activity/Head'
import { Head as GamesHead } from './games/Head'
import { Head as NewWorksHead } from './new-works/Head'
import { Games } from './games/Games'
import { GameItem } from '@/interfaces/game/game.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { Ad } from '@/components/common/site/Ad'
import { NewWorks } from './new-works/NewWorks'
import { RecentUpdates } from './recent-update/RecentUpdates'
import { Head as RecentUpdateHead } from './recent-update/Head'
import { Hero } from './hero/Hero'

interface ContainerProps {
  activities: ActivityInterface[]
  activitiesMeta: PaginatedMeta
  games: GameItem[]
  content_limit: ContentLimit
  newWorks: GameItem[]
  recentUpdates: GameItem[]
}

export const Container = ({
  activities,
  activitiesMeta,
  games,
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
      {recentUpdates.length > 0 && (
        <div className="flex flex-col gap-6">
          <RecentUpdateHead />
          <RecentUpdates recentUpdates={recentUpdates} content_limit={content_limit} />
        </div>
      )}
      <Ad id={3} />
      <div className="flex flex-col gap-6">
        <GamesHead />
        <Games games={games} content_limit={content_limit} />
      </div>
      <Ad id={1} />
      <div className="flex flex-col gap-6">
        <ActivityHead />
        <Activity activities={activities} meta={activitiesMeta} />
      </div>
      <Ad id={2} />
    </div>
  )
}

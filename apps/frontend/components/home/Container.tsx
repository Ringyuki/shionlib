import { Head as NewWorksHead } from './new-works/Head'
import { GameItem } from '@/interfaces/game/game.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { AdSlot } from '@/components/common/site/Ad'
import { AD_PLACEMENTS } from '@/constants/ad-placements'
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
      <AdSlot placement={AD_PLACEMENTS.HOME_AFTER_HERO} />
      <div className="flex flex-col gap-6">
        <NewWorksHead />
        <NewWorks newWorks={newWorks} content_limit={content_limit} />
      </div>
      <AdSlot placement={AD_PLACEMENTS.HOME_AFTER_NEW_WORKS} />
      {recentUpdates.length > 0 && (
        <div className="flex flex-col gap-6">
          <RecentUpdateHead />
          <RecentUpdates recentUpdates={recentUpdates} content_limit={content_limit} />
        </div>
      )}
      <AdSlot placement={AD_PLACEMENTS.HOME_AFTER_RECENT_UPDATES} />
      <Hot hotGames={hotGames} content_limit={content_limit} initialMeta={hotMeta} />
      <AdSlot placement={AD_PLACEMENTS.HOME_AFTER_HOT} />
    </div>
  )
}

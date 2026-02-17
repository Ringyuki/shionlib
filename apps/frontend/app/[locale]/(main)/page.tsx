import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { shionlibRequest } from '@/utils/request'
import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import { GameItem } from '@/interfaces/game/game.interface'
import { Container } from '@/components/home/Container'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { getLastFridays } from '../_helpers/getFriday'

const getData = async () => {
  const { lastFriday, thisFriday } = getLastFridays()
  const [activitiesRes, hotGames, newWorks, recentUpdates] = await Promise.all([
    shionlibRequest().get<PaginatedResponse<ActivityInterface>>(`/activity/list`, {
      params: {
        page: 1,
        pageSize: 50,
      },
    }),
    shionlibRequest().get<PaginatedResponse<GameItem, { content_limit: ContentLimit }>>(
      `/game/list`,
      {
        params: {
          'filter[sort_by]': 'hot_score',
          page: 1,
          pageSize: 40,
        },
      },
    ),
    shionlibRequest().get<PaginatedResponse<GameItem, { content_limit: ContentLimit }>>(
      `/game/list`,
      {
        params: {
          'filter[start_date]': lastFriday.toISOString(),
          'filter[end_date]': new Date(thisFriday.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          'filter[sort_by]': 'release_date',
          'filter[sort_order]': 'desc',
          page: 1,
          pageSize: 40,
        },
      },
    ),
    shionlibRequest().get<PaginatedResponse<GameItem, { content_limit: ContentLimit }>>(
      `/game/recent-update`,
      {
        params: {
          page: 1,
          pageSize: 40,
        },
      },
    ),
  ])

  const activitiesItems = activitiesRes.data?.items!
  const activitiesMeta = activitiesRes.data?.meta!

  return {
    activities: activitiesItems,
    activitiesMeta,
    hotGames: hotGames.data?.items!,
    content_limit: hotGames.data?.meta.content_limit ?? 0,
    newWorks: newWorks.data?.items!,
    recentUpdates: recentUpdates.data?.items!,
  }
}

export default async function HomePage() {
  const { activities, activitiesMeta, hotGames, content_limit, newWorks, recentUpdates } =
    await getData()
  return (
    <div className="container mx-auto my-4">
      <Container
        activities={activities}
        activitiesMeta={activitiesMeta}
        games={hotGames}
        content_limit={content_limit}
        newWorks={newWorks}
        recentUpdates={recentUpdates}
      />
    </div>
  )
}

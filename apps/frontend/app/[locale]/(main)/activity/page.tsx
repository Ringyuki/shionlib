import { Activity } from '@/components/activity/Activity'
import { Head as ActivityHead } from '@/components/activity/Head'
import { PaginatedMeta, PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { shionlibRequest } from '@/utils/request'
import { getTranslations } from 'next-intl/server'
import { ContentLimit } from '@/interfaces/user/user.interface'

const getData = async () => {
  const { data } = await shionlibRequest().get<
    PaginatedResponse<ActivityInterface, { content_limit: ContentLimit }>
  >(`/activity/list`, {
    params: {
      page: 1,
      pageSize: 20,
    },
  })

  return {
    activities: data?.items ?? [],
    meta: data?.meta ?? {
      totalItems: 0,
      itemCount: 0,
      itemsPerPage: 20,
      totalPages: 1,
      currentPage: 1,
      content_limit: ContentLimit.NEVER_SHOW_NSFW_CONTENT,
    },
  }
}

export default async function ActivityPage() {
  const { activities, meta } = await getData()

  return (
    <div className="w-full mx-auto my-4 space-y-6">
      <ActivityHead />
      <Activity activities={activities} meta={meta} />
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async () => {
  const t = await getTranslations('Components.Home.Activity.Head')
  return {
    title: t('title'),
    description: t('description'),
    path: '/activity',
  }
})

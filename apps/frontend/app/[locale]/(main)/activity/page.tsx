import { Activity } from '@/components/activity/Activity'
import { Head as ActivityHead } from '@/components/activity/Head'
import { PaginatedMeta, PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { shionlibRequest } from '@/utils/request'
import { getTranslations } from 'next-intl/server'

const DEFAULT_ACTIVITY_PAGE_SIZE = 50

const DEFAULT_ACTIVITY_META: PaginatedMeta = {
  totalItems: 0,
  itemCount: 0,
  itemsPerPage: DEFAULT_ACTIVITY_PAGE_SIZE,
  totalPages: 1,
  currentPage: 1,
}

const getData = async () => {
  const { data } = await shionlibRequest().get<PaginatedResponse<ActivityInterface>>(
    `/activity/list`,
    {
      params: {
        page: 1,
        pageSize: DEFAULT_ACTIVITY_PAGE_SIZE,
      },
    },
  )

  return {
    activities: data?.items ?? [],
    meta: data?.meta ?? DEFAULT_ACTIVITY_META,
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

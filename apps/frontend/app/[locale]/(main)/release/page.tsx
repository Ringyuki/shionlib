import { ReleaseListHeader } from '@/components/release/list/Header'
import { Releases } from '@/components/release/list/Releases'
import { ReleaseItem } from '@/interfaces/release/upload.interface'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getTranslations } from 'next-intl/server'

const getData = async (page: number = 1) => {
  const data = await shionlibRequest().get<PaginatedResponse<ReleaseItem>>(
    `/game/download-source/list`,
    {
      params: {
        page,
        pageSize: 25,
      },
    },
  )
  return data
}

interface ReleasesPageProps {
  searchParams: Promise<{
    page: number
  }>
}

export default async function ReleasesPage({ searchParams }: ReleasesPageProps) {
  const { page } = await searchParams
  const data = await getData(page)

  return (
    <div className="container mx-auto my-4">
      <ReleaseListHeader />
      <Releases releases={data.data?.items || []} meta={data.data?.meta!} />
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async () => {
  const t = await getTranslations('Components.Release.List.Header')
  return {
    title: t('title'),
    description: t('description'),
    path: '/release',
  }
})

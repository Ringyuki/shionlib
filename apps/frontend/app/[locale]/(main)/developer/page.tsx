import { Header } from '@/components/developer/list/Header'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Developer } from '@/interfaces/developer/developer.interface'
import { Search } from '@/components/developer/list/Search'
import { Developers } from '@/components/developer/list/Developers'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getTranslations } from 'next-intl/server'

interface DeveloperPageProps {
  searchParams: Promise<{
    page: number
    q: string
  }>
}

const getData = async (page: number = 1, q: string = '') => {
  const { data } = await shionlibRequest().get<PaginatedResponse<Developer>>(`/developer/list`, {
    params: {
      page: page,
      pageSize: 50,
      q: q,
    },
  })
  return data
}

export default async function DeveloperPage({ searchParams }: DeveloperPageProps) {
  const { page, q } = await searchParams
  const data = await getData(page, q)
  return (
    <div className="container mx-auto my-4">
      <Header />
      <div className="flex flex-col gap-6">
        <Search initialQ={q} />
        <Developers developers={data?.items || []} meta={data?.meta!} extraQuery={{ q }} />
      </div>
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async () => {
  const t = await getTranslations('Components.Developer.List.Header')
  return {
    title: t('title'),
    description: t('description'),
    path: '/developer',
  }
})

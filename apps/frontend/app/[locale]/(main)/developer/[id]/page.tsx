import { notFound } from 'next/navigation'
import { shionlibRequest } from '@/utils/request'
import { Developer } from '@/interfaces/developer/developer.interface'
import { GameItem } from '@/interfaces/game/game.interface'
import { DeveloperContent } from '@/components/developer/DeveloperContent'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getPreferredDeveloperContent } from '@/components/game/description/helpers/getPreferredContent'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface DeveloperPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    page: string
  }>
}

const getData = async (id: string, page: string) => {
  const [developer, games] = await Promise.all([
    shionlibRequest().get<Developer>(`/developer/${id}`),
    shionlibRequest().get<PaginatedResponse<GameItem, { content_limit: ContentLimit }>>(
      `/game/list`,
      {
        params: {
          page: page,
          pageSize: 15,
          developer_id: id,
        },
      },
    ),
  ])
  return { developer: developer.data, games: games.data?.items ?? [], meta: games.data?.meta }
}

export default async function DeveloperPage({ params, searchParams }: DeveloperPageProps) {
  const { id } = await params
  if (!id || isNaN(Number(id))) {
    notFound()
  }
  const { page } = await searchParams
  const { developer, games, meta } = await getData(id, page ?? '1')
  if (!developer) {
    notFound()
  }
  return (
    <div className="my-4 w-full flex flex-col gap-4">
      <DeveloperContent
        developer={developer}
        games={games}
        meta={meta!}
        works_count={meta?.totalItems ?? 0}
        content_limit={meta?.content_limit!}
      />
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(
  async ({ locale, id }: { locale: string; id: string }) => {
    // duplicated request here, should add cache in the future
    // TODO: add cache for repeated requests
    const developer = await shionlibRequest().get<Developer>(`/developer/${id}`)
    const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
    const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
    const { intro } = getPreferredDeveloperContent(developer.data!, lang)
    return {
      title: developer.data!.name,
      description: intro
        ? intro
            .replace(/[\r\n]+/g, ' ')
            .trim()
            .slice(0, 100) + '...'
        : undefined,
      path: `/developer/${id}`,
      og: {
        title: developer.data!.name || developer.data?.aliases[0],
        description: intro,
        image: developer.data!.logo,
        aspect: '1:1',
      },
    }
  },
)

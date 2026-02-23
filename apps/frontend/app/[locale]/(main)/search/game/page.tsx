import { PaginatedResponse, PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { GameSearchItem } from '@/interfaces/game/game.interface'
import { shionlibRequest } from '@/utils/request'
import { Results } from '@/components/common/search/game/Results'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface SearchGamePageProps {
  searchParams: Promise<{
    page?: string
    q?: string
    tag?: string
  }>
}

const getData = async (page: string | undefined, q?: string, tag?: string) => {
  const data = await shionlibRequest().get<
    PaginatedResponse<GameSearchItem, { content_limit: ContentLimit }>
  >(`/search/games`, {
    params: {
      page: page ?? '1',
      pageSize: 20,
      ...(q ? { q } : {}),
      ...(tag ? { tag } : {}),
    },
  })
  return data
}

export default async function SearchGamePage({ searchParams }: SearchGamePageProps) {
  const { page, q, tag } = await searchParams
  if (!q && !tag) return notFound()
  const data = await getData(page, q, tag)
  return (
    <div className="w-full mx-auto my-4 space-y-6">
      <Results
        games={data.data?.items ?? []}
        pagination={data.data?.meta as PaginatedMeta}
        q={q}
        tag={tag}
        content_limit={data.data?.meta?.content_limit!}
      />
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(
  async ({ q, tag, page }: { q?: string; tag?: string; page?: string }) => {
    const t = await getTranslations('Pages.Search.Game')
    const keyword = q || tag || ''
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (tag) params.set('tag', tag)
    params.set('page', page ?? '1')
    return {
      title: t('title', { q: keyword }),
      path: `/search/game?${params.toString()}`,
      robots: {
        index: false,
        follow: false,
      },
    }
  },
)

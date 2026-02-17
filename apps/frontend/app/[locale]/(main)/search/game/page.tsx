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
    page: string
    q: string
  }>
}

const getData = async (page: string, q: string) => {
  const data = await shionlibRequest().get<
    PaginatedResponse<GameSearchItem, { content_limit: ContentLimit }>
  >(`/search/games`, {
    params: {
      page: page ?? '1',
      pageSize: 20,
      q,
    },
  })
  return data
}

export default async function SearchGamePage({ searchParams }: SearchGamePageProps) {
  const { page, q } = await searchParams
  if (!q) return notFound()
  const data = await getData(page, q)
  return (
    <div className="container mx-auto my-4 space-y-6">
      <Results
        games={data.data?.items ?? []}
        pagination={data.data?.meta as PaginatedMeta}
        q={q}
        content_limit={data.data?.meta?.content_limit!}
      />
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(
  async ({ q, page }: { q: string; page: string }) => {
    const t = await getTranslations('Pages.Search.Game')
    return {
      title: t('title', { q }),
      path: `/search/game?q=${q}&page=${page}`,
      robots: {
        index: false,
        follow: false,
      },
    }
  },
)

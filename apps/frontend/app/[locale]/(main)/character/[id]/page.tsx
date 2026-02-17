import { notFound } from 'next/navigation'
import { shionlibRequest } from '@/utils/request'
import { CharacterContent } from '@/components/character/CharacterContent'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getPreferredCharacterContent } from '@/components/game/description/helpers/getPreferredContent'
import { GameCharacter, GameItem } from '@/interfaces/game/game.interface'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface CharacterPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    page: string
  }>
}

const getData = async (id: string, page: string) => {
  const [character, games] = await Promise.all([
    shionlibRequest().get<GameCharacter>(`/character/${id}`),
    shionlibRequest().get<PaginatedResponse<GameItem, { content_limit: ContentLimit }>>(
      `/game/list`,
      {
        params: {
          page: page,
          pageSize: 15,
          character_id: id,
        },
      },
    ),
  ])
  return {
    character: character.data,
    games: games.data?.items ?? [],
    meta: games.data?.meta,
  }
}

export default async function CharacterPage({ params, searchParams }: CharacterPageProps) {
  const { id } = await params
  if (!id || isNaN(Number(id))) {
    notFound()
  }
  const { page } = await searchParams
  const { character, games, meta } = await getData(id, page ?? '1')
  if (!character) {
    notFound()
  }
  return (
    <div className="my-4 w-full flex flex-col gap-4">
      <CharacterContent
        character={character}
        games={games}
        meta={meta!}
        appearances_count={meta?.totalItems ?? 0}
        content_limit={meta?.content_limit!}
      />
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(
  async ({ locale, id }: { locale: string; id: string }) => {
    const character = await shionlibRequest().get<GameCharacter>(`/character/${id}`)
    const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
    const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
    const { name } = getPreferredCharacterContent(character.data!, 'name', lang)
    const { intro } = getPreferredCharacterContent(character.data!, 'intro', lang)
    return {
      title: name,
      description: intro
        ? intro
            .replace(/[\r\n]+/g, ' ')
            .trim()
            .slice(0, 100) + '...'
        : undefined,
      path: `/character/${id}`,
      og: {
        title: name,
        description: intro,
        image: character.data!.image,
        aspect: '2:3' as const,
      },
    }
  },
)

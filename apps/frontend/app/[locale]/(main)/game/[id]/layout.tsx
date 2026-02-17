import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { shionlibRequest } from '@/utils/request'
import { GameData } from '@/interfaces/game/game.interface'
import { ViewPing } from '@/components/game/ViewPing'
import { GameHeader } from '@/components/game/description/GameHeader'
import { Ad } from '@/components/common/site/Ad'
import { GameTabsNav } from '@/components/game/TabsNav'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'

interface GameLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string; id: string }>
}

export default async function GameLayout({ children, params }: GameLayoutProps) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const header = await shionlibRequest().get<GameData>(`/game/${id}/header`)
  if (!header.data) {
    notFound()
  }
  return (
    <div className="my-4 w-full">
      <>
        <ViewPing />
        <div className="flex flex-col gap-8">
          <GameHeader game={header.data} />
          <div
            className="flex flex-col gap-4 shadow-content-strong bg-card-soft w-full rounded-md p-4"
            id="game-content"
          >
            <div className="w-full">
              <div className="flex flex-col gap-8">
                <GameTabsNav />
                {children}
              </div>
            </div>
          </div>
          <Ad id={3} />
        </div>
      </>
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(
  async ({ locale, id }: { locale: string; id: string }) => {
    const game = await shionlibRequest().get<GameData>(`/game/${id}`)
    const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
    const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
    const { title } = getPreferredContent(game.data!, 'title', lang)
    const { cover, aspect } = getPreferredContent(game.data!, 'cover', lang)
    const intro =
      getPreferredContent(game.data!, 'intro', lang)
        .intro.replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, 100) + '...'
    return {
      title: title,
      description: intro,
      path: `/game/${id}`,
      og: {
        title: title,
        description: intro,
        image: cover?.url ?? '',
        aspect: aspect === '1 / 1.5' ? '2:3' : aspect === '1.5 / 1' ? '3:2' : '1:1',
      },
    }
  },
)

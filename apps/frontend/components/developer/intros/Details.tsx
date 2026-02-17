import { Developer } from '@/interfaces/developer/developer.interface'
import { getTranslations, getLocale } from 'next-intl/server'
import { getPreferredDeveloperContent } from '@/components/game/description/helpers/getPreferredContent'
import { BBCodeContent } from '@/components/common/content/BBCode'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { BangumiExtraInfoKeyMap } from '@/components/game/description/constants/BangumiExtraInfoKeyMap'

interface DetailsProps {
  developer: Developer
}

export const Details = async ({ developer }: DetailsProps) => {
  const t = await getTranslations('Components.Developer.Intros.Details')
  const keyTrans = await getTranslations('Components.Game.Description.BangumiExtraInfoKeyMap')

  const getKeyTrans = (key: string) => {
    const _key = BangumiExtraInfoKeyMap[key]
    if (_key) {
      return keyTrans(_key)
    }
    return key
  }

  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap]
  const intro = getPreferredDeveloperContent(developer, lang)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BBCodeContent content={intro.intro || t('no_intro')} className="text-sm break-words" />
      </div>
      {developer.extra_info.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {developer.extra_info.map(info => (
              <div key={info.key} className="flex flex-col gap-1">
                <div className="text-sm text-gray-500">{getKeyTrans(info.key)}</div>
                <div className="text-sm break-words break-all">
                  {info.value.startsWith('http') ? (
                    <Link
                      href={info.value}
                      target="_blank"
                      className="flex items-center gap-1 hover:underline"
                    >
                      {info.value}
                      <ExternalLink className="size-3 shrink-0" />
                    </Link>
                  ) : (
                    info.value
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

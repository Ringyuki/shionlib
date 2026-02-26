'use client'

import { Activity } from '@/interfaces/activity/activity.interface'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { useLocale } from 'next-intl'
import { GameData } from '@/interfaces/game/game.interface'
import { Badge } from '@/components/shionui/Badge'

interface WalkthroughCreateProps {
  activity: Activity
}

export const WalkthroughCreate = ({ activity }: WalkthroughCreateProps) => {
  const t = useTranslations('Components.Home.Activity.Activities.WalkthroughCreate')
  const locale = useLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { title } = getPreferredContent(activity.game as GameData, 'title', lang)
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span>{t('prefix')}</span>
      <Badge intent="primary" appearance="solid">
        {t('game')}
      </Badge>
      <Link
        className="font-medium hover:opacity-85 transition-all duration-200"
        href={`/game/${activity.game?.id}`}
      >
        {title}
      </Link>
      <span>{t('suffix')}</span>
      <Link
        className="font-medium hover:opacity-85 transition-all duration-200"
        href={`/game/${activity.game?.id}/walkthrough/${activity.walkthrough?.id}`}
      >
        {activity.walkthrough?.title}
      </Link>
    </div>
  )
}

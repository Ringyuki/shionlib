'use client'

import { Activity } from '@/interfaces/activity/activity.interface'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { useLocale } from 'next-intl'
import { GameData } from '@/interfaces/game/game.interface'
import { Badge } from '@/components/shionui/Badge'

interface CreateProps {
  activity: Activity
}

export const Create = ({ activity }: CreateProps) => {
  const t = useTranslations('Components.Home.Activity.Activities.Create')
  const locale = useLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { title } = getPreferredContent(activity.game as GameData, 'title', lang)
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span>{t('createdPrefix')}</span>
      <Badge variant="default">{t('game')}</Badge>
      <Link
        className="font-medium hover:opacity-85 transition-all duration-200"
        href={`/game/${activity.game?.id}`}
      >
        {title}
      </Link>
    </div>
  )
}

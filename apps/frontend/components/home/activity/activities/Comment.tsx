'use client'

import { Activity } from '@/interfaces/activity/activity.interface'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation.client'
import { GameData } from '@/interfaces/game/game.interface'
import { Badge } from '@/components/shionui/Badge'
import { ScrollArea } from '@/components/shionui/ScrollArea'

interface CommentProps {
  activity: Activity
}

export const Comment = ({ activity }: CommentProps) => {
  const locale = useLocale()
  const t = useTranslations('Components.Home.Activity.Activities.Comment')
  const router = useRouter()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { title } = getPreferredContent(activity.game as unknown as GameData, 'title', lang)
  const commentHref = `/game/${activity.game?.id}/comments#data-comment-id-${activity.comment?.id}`

  const handleCommentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('a')) return
    router.push(commentHref)
  }

  const handleCommentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      router.push(commentHref)
    }
  }

  return (
    <>
      <div className="flex gap-2 items-center">
        <span>{t('commentedPrefix')}</span>
        <Badge variant="default">{t('game')}</Badge>
        <Link
          href={`/game/${activity.game?.id}`}
          className="font-medium hover:opacity-85 transition-all duration-200"
        >
          {title}
        </Link>
        {t('commentedSuffix') && <span>{t('commentedSuffix')}</span>}
      </div>
      <div
        role="link"
        tabIndex={0}
        className="cursor-pointer"
        onClick={handleCommentClick}
        onKeyDown={handleCommentKeyDown}
        aria-label={t('game')}
      >
        <ScrollArea className="max-h-24 rounded-lg border">
          <div
            dangerouslySetInnerHTML={{ __html: activity.comment?.html || '' }}
            className="p-2 bg-card hover:bg-card-hover transition-colors"
          />
        </ScrollArea>
      </div>
    </>
  )
}

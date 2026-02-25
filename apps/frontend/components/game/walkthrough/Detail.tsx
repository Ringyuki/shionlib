'use client'

import { useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'
import { Walkthrough, WalkthroughStatus } from '@/interfaces/walkthrough/walkthrough.interface'
import { Avatar } from '@/components/common/user/Avatar'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
import { timeFromNow } from '@/utils/time-format'
import { useShionlibUserStore } from '@/store/userStore'
import { useScrollToElem } from '@/hooks/useScrollToElem'
import { Pencil, Undo2 } from 'lucide-react'

interface WalkthroughDetailProps {
  walkthrough: Walkthrough
  gameId: string
}

export const WalkthroughDetail = ({ walkthrough, gameId }: WalkthroughDetailProps) => {
  const t = useTranslations('Components.Game.Walkthrough.Detail')
  const locale = useLocale()
  const router = useRouter()
  const { user } = useShionlibUserStore()

  const canEdit = user.id === walkthrough.creator.id || user.role >= 2
  const scrollTo = useScrollToElem({ updateHash: false })

  useEffect(() => {
    scrollTo('game-content')
  }, [scrollTo])

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <h1 className="text-2xl font-bold">{walkthrough.title}</h1>
            <Button
              size="sm"
              intent="secondary"
              appearance="ghost"
              renderIcon={<Undo2 className="size-4" />}
              onClick={() => router.back()}
            >
              {t('back')}
            </Button>
          </div>
          {canEdit && (
            <Button
              size="sm"
              intent="secondary"
              appearance="outline"
              renderIcon={<Pencil className="size-4" />}
              onClick={() =>
                router.push(`/game/${gameId}/walkthrough/edit?walkthrough_id=${walkthrough.id}`)
              }
            >
              {t('edit')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar user={walkthrough.creator} className="size-6" />
            <span>{walkthrough.creator.name}</span>
          </div>
          <span>{timeFromNow(walkthrough.created, locale)}</span>
          {walkthrough.edited && <span className="text-muted-foreground/60">{t('edited')}</span>}
          {walkthrough.status === WalkthroughStatus.DRAFT && (
            <Badge intent="secondary" appearance="solid">
              {t('draft')}
            </Badge>
          )}
          {walkthrough.status === WalkthroughStatus.HIDDEN && (
            <Badge intent="warning" appearance="solid">
              {t('hidden')}
            </Badge>
          )}
        </div>

        {walkthrough.status === WalkthroughStatus.DRAFT && (
          <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {t('draft_notice')}
          </div>
        )}
      </div>

      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:hover:text-primary/80 [&_a]:transition-colors"
        dangerouslySetInnerHTML={{ __html: walkthrough.html }}
      />
    </article>
  )
}

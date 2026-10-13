import { Avatar, Inline, Link, Tag, Text, useImageResolver } from '@hina-ui/react'
import { SquarePen } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { labelOf } from '~/shared/i18n/labels'
import { Button } from '~/shared/ui/button'
import { writingPath, type Walkthrough, type WalkthroughSummary } from '../walkthrough'
import { GuidePicker } from './guide-picker'
import { WalkthroughState } from './walkthrough-state'

type GuideBarProps = {
  gameId: number
  summaries: readonly WalkthroughSummary[]
  shown: Walkthrough
  own: boolean
}

export function GuideBar({ gameId, summaries, shown, own }: GuideBarProps) {
  const t = useTranslations('walkthrough')
  const languages = useMessages().walkthrough.language
  const locale = useLocale()
  const resolveImage = useImageResolver()
  const { creator } = shown
  const listed = summaries.find(summary => summary.id === shown.id)
  return (
    <Inline gap="none" align="center" className="gap-x-3 gap-y-0.5">
      {listed !== undefined && summaries.length > 1 ? (
        <GuidePicker gameId={gameId} summaries={summaries} shown={listed} />
      ) : (
        <Inline gap="sm" align="center" wrap={false} className="min-w-0">
          <Avatar
            size="sm"
            name={creator.name}
            alt=""
            src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
          />
          <Text as="span" size="sm" weight="medium" truncate>
            <Link asChild tone="neutral">
              <RouterLink to={profilePath(locale, creator.id)} prefetch="intent">
                {creator.name}
              </RouterLink>
            </Link>
          </Text>
        </Inline>
      )}
      <WalkthroughState walkthrough={shown} />
      {shown.lang !== null && <Tag variant="outline">{labelOf(languages, shown.lang)}</Tag>}
      <Text as="span" size="sm" tone="muted" className="max-sm:order-last max-sm:w-full">
        {t('updated', { date: new Date(shown.updated) })}
      </Text>
      <WriteButton gameId={gameId} own={own} className="ms-auto" />
    </Inline>
  )
}

type WriteButtonProps = { gameId: number; own: boolean; solid?: boolean; className?: string }

export function WriteButton({ gameId, own, solid = false, className }: WriteButtonProps) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  return (
    <Button
      asChild
      loginRequired
      size={solid ? 'md' : 'sm'}
      variant={solid ? 'solid' : 'outline'}
      tone={solid ? 'accent' : 'neutral'}
      className={className}
    >
      <RouterLink to={writingPath(locale, gameId)} prefetch="none">
        <SquarePen aria-hidden />
        {t(own ? 'editOwn' : 'write')}
      </RouterLink>
    </Button>
  )
}

import { Inline, Link, Tag, Text, Time } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { labelOf } from '~/shared/i18n/labels'
import { stateOf, type WalkthroughItem } from '../walkthrough'

type Described = Pick<WalkthroughItem, 'creator' | 'lang' | 'updated' | 'status' | 'review_pending'>

export function WalkthroughFacts({ walkthrough }: { walkthrough: Described }) {
  const t = useTranslations('walkthrough')
  const labels = useMessages().walkthrough
  const locale = useLocale()
  const state = stateOf(walkthrough)
  return (
    <Inline gap="md" align="center" className="gap-y-1">
      <Link asChild tone="neutral" className="text-sm">
        <RouterLink to={profilePath(locale, walkthrough.creator.id)}>
          {walkthrough.creator.name}
        </RouterLink>
      </Link>
      {walkthrough.lang !== null && (
        <Tag size="sm" variant="outline">
          {labelOf(labels.language, walkthrough.lang)}
        </Tag>
      )}
      <Text size="sm" tone="faint">
        {t.rich('updated', { time: () => <Time value={walkthrough.updated} format="relative" /> })}
      </Text>
      {state !== 'published' && (
        <Tag size="sm" tone={state === 'hidden' ? 'danger' : 'warning'}>
          {t(`state.${state}`)}
        </Tag>
      )}
    </Inline>
  )
}

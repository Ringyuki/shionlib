import { Avatar, Inline, Link, Stack, Text, Time, useImageResolver } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { labelOf } from '~/shared/i18n/labels'
import type { WalkthroughItem } from '../walkthrough'

type Dated = Pick<WalkthroughItem, 'lang' | 'updated'>

type Described = Dated & Pick<WalkthroughItem, 'creator'>

export function WalkthroughFacts({ walkthrough }: { walkthrough: Dated }) {
  const t = useTranslations('walkthrough')
  const labels = useMessages().walkthrough
  return (
    <Text as="span" size="sm" tone="faint">
      {t.rich('updated', { time: () => <Time value={walkthrough.updated} format="relative" /> })}
      {walkthrough.lang !== null && ` · ${labelOf(labels.language, walkthrough.lang)}`}
    </Text>
  )
}

export function WalkthroughByline({ walkthrough }: { walkthrough: Described }) {
  const locale = useLocale()
  const resolveImage = useImageResolver()
  const { creator } = walkthrough
  const profile = profilePath(locale, creator.id)
  return (
    <Inline gap="md" align="center" wrap={false} className="min-w-0">
      <RouterLink to={profile} aria-hidden tabIndex={-1} className="shrink-0">
        <Avatar
          name={creator.name}
          src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
          className="size-9"
        />
      </RouterLink>
      <Stack gap="none" className="min-w-0">
        <Link asChild tone="neutral" className="truncate font-medium">
          <RouterLink to={profile}>{creator.name}</RouterLink>
        </Link>
        <WalkthroughFacts walkthrough={walkthrough} />
      </Stack>
    </Inline>
  )
}

export function WalkthroughCredit({ walkthrough }: { walkthrough: Described }) {
  const t = useTranslations('walkthrough')
  const labels = useMessages().walkthrough
  const locale = useLocale()
  const resolveImage = useImageResolver()
  const { creator } = walkthrough
  return (
    <Inline gap="sm" align="center" wrap={false} className="min-w-0">
      <Avatar
        size="sm"
        name={creator.name}
        src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
        className="size-5 shrink-0 text-[0.625rem]"
      />
      <Text as="span" size="sm" tone="faint" className="min-w-0 break-words">
        <Link asChild tone="neutral">
          <RouterLink to={profilePath(locale, creator.id)}>{creator.name}</RouterLink>
        </Link>
        {' · '}
        {t.rich('updated', { time: () => <Time value={walkthrough.updated} format="relative" /> })}
        {walkthrough.lang !== null && ` · ${labelOf(labels.language, walkthrough.lang)}`}
      </Text>
    </Inline>
  )
}

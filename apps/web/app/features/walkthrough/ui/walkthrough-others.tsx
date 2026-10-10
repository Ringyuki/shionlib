import { Heading, Inline, Link, Stack, Text, Time } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { walkthroughPath, type WalkthroughItem } from '../walkthrough'

type WalkthroughOthersProps = { gameId: number; others: WalkthroughItem[] }

export function WalkthroughOthers({ gameId, others }: WalkthroughOthersProps) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  if (others.length === 0) {
    return null
  }
  return (
    <Stack as="section" gap="sm" className="border-line border-t pt-6">
      <Heading level={2} size="sm" weight="normal" className="text-muted">
        {t('others')}
      </Heading>
      <Stack gap="xs">
        {others.map(other => (
          <Inline key={other.id} justify="between" align="baseline" gap="md" className="gap-y-0.5">
            <Link asChild tone="neutral" className="font-medium break-words">
              <RouterLink to={walkthroughPath(locale, gameId, other.id)} prefetch="intent">
                {other.title}
              </RouterLink>
            </Link>
            <Text as="span" size="sm" tone="faint" className="shrink-0">
              {`${other.creator.name} · `}
              {t.rich('updated', { time: () => <Time value={other.updated} format="relative" /> })}
            </Text>
          </Inline>
        ))}
      </Stack>
    </Stack>
  )
}

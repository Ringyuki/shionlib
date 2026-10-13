import { Empty, Heading, Inline, PageHeader, Stack, Switch, Text } from '@hina-ui/react'
import { CalendarX, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { requiresResources, resourceRuleFor } from '~/features/game'
import { Button } from '~/shared/ui/button'
import { listsEveryGame, monthStart, releasesPath, shifted, type Releases } from '../release'
import { ReleaseDays } from './release-days'

export function ReleasesPage({ releases }: { releases: Releases }) {
  const t = useTranslations('release')
  const locale = useLocale()
  const format = useFormatter()
  const navigate = useNavigate()
  const { month, resources, days, total, current } = releases
  const only = requiresResources(resources, listsEveryGame)
  const to = (by: number) => releasesPath(locale, shifted(month, by), resources)
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} description={t('description')} />
      <Inline gap="md" align="center" justify="between">
        <Inline gap="sm" align="center" wrap={false}>
          <Button asChild variant="soft" tone="neutral" size="sm" iconOnly>
            <Link to={to(-1)} prefetch="intent" aria-label={t('previous')}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <Heading
            level={2}
            size="lg"
            weight="semibold"
            className="min-w-32 text-center tabular-nums"
          >
            {format.dateTime(monthStart(month), {
              year: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            })}
          </Heading>
          <Button asChild variant="soft" tone="neutral" size="sm" iconOnly>
            <Link to={to(1)} prefetch="intent" aria-label={t('next')}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            tone="neutral"
            size="sm"
            disabled={current}
            onClick={() => void navigate(releasesPath(locale, undefined, resources))}
          >
            {t('thisMonth')}
          </Button>
        </Inline>
        <Inline gap="md" align="center">
          <Text size="sm" tone="muted" className="tabular-nums">
            {t('count', { total })}
          </Text>
          <Switch
            size="sm"
            checked={only}
            onCheckedChange={next =>
              void navigate(
                releasesPath(
                  locale,
                  current ? undefined : month,
                  resourceRuleFor(next, listsEveryGame),
                ),
              )
            }
          >
            {t('onlyWithResources')}
          </Switch>
        </Inline>
      </Inline>
      {days.length === 0 ? (
        <Empty
          icon={<CalendarX />}
          title={t('empty')}
          description={only ? t('emptyNarrowed') : undefined}
        />
      ) : (
        <ReleaseDays days={days} />
      )}
    </Stack>
  )
}

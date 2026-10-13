import { Inline, Text } from '@hina-ui/react'
import { Heart } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { sponsorPaths, type Self, type SponsorState } from '../sponsor'

type WallActionProps = {
  state: SponsorState
  viewer: Self | null
}

export function WallAction({ state, viewer }: WallActionProps) {
  const t = useTranslations('sponsor')
  const format = useFormatter()
  const locale = useLocale()
  const until = viewer?.is_sponsor === true ? viewer.sponsor_expires_at : null
  if (!state.enabled) {
    return (
      <Inline align="center" className="min-h-9">
        <Text size="sm" tone="muted">
          {t('closed')}
        </Text>
      </Inline>
    )
  }
  return (
    <Inline gap="md" align="center" justify="end" className="max-sm:w-full max-sm:justify-start">
      {until !== null && (
        <Text size="sm" tone="muted">
          {t('badgeUntil', { date: format.dateTime(new Date(until), { dateStyle: 'long' }) })}
        </Text>
      )}
      <Button asChild className="max-sm:w-full">
        <Link to={sponsorPaths(locale).checkout}>
          <Heart aria-hidden />
          {t(until === null ? 'become' : 'again')}
        </Link>
      </Button>
    </Inline>
  )
}

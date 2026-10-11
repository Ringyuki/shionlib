import {
  Alert,
  Card,
  Divider,
  Grid,
  Inline,
  Stack,
  Statistic,
  Tag,
  Text,
  Tooltip,
} from '@hina-ui/react'
import { CircleHelp } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { StorageMeter } from '~/features/resource'
import { fileLimit, type Allowance } from '~/features/upload'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Summary } from '../uploader'

type AccountProps = {
  allowance: Allowance
  summary: Summary
}

export function Account({ allowance, summary }: AccountProps) {
  const t = useTranslations('uploader.account')
  const format = useFormatter()
  const bytes = useBytes()
  const limit = allowance.stored_limit
  const frozen = allowance.frozen_until
  return (
    <Card as="aside" aria-label={t('title')}>
      <Stack gap="md">
        {limit === null ? (
          <Inline gap="md" align="baseline" justify="between" wrap={false}>
            <Text size="sm">{t('storage')}</Text>
            <Text size="sm" tone="muted" className="tabular-nums">
              {bytes(allowance.stored + allowance.in_flight)}
            </Text>
          </Inline>
        ) : (
          <StorageMeter
            limit={limit}
            stored={allowance.stored}
            uploading={allowance.in_flight}
            chosen={0}
          />
        )}
        <Inline>
          <Tag size="sm">
            {t(`tier.${allowance.tier}`)}
            <Tooltip
              content={
                limit === null
                  ? t('unlimited')
                  : t('fileLimit', { size: bytes(fileLimit(allowance)) })
              }
            >
              <CircleHelp
                role="img"
                aria-label={t('tierHelp')}
                tabIndex={0}
                className="cursor-help"
              />
            </Tooltip>
          </Tag>
        </Inline>
        <Alert tone="warning" open={frozen !== null}>
          {frozen !== null &&
            t('frozen', { date: format.dateTime(new Date(frozen), { dateStyle: 'long' }) })}
        </Alert>
        <Divider />
        <Grid className="grid-cols-2 gap-x-4 gap-y-5">
          <Statistic label={t('downloads')} value={summary.downloads} size="sm" />
          <Statistic
            label={t('recent', { days: summary.recent_days })}
            value={summary.recent}
            size="sm"
          />
          <Statistic label={t('games')} value={summary.games} size="sm" />
          <Statistic label={t('files')} value={summary.files} size="sm" />
        </Grid>
      </Stack>
    </Card>
  )
}

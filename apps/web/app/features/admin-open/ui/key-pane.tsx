import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Stack,
  Tag,
  Text,
  Time,
} from '@hina-ui/react'
import { Ban, RotateCcw } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { PaneSection, ReviewPane, UserRef } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import type { KeyDetail } from '../admin-open'
import { UsageChart } from './usage-chart'

type KeyPaneProps = {
  detail: KeyDetail | undefined
  pending: boolean
  onClose: () => void
  onSuspend: (detail: KeyDetail) => void
  onRestore: (detail: KeyDetail) => void
  onLimit: (detail: KeyDetail) => void
}

const facts = 'text-sm [--hn-dl-term-width:5rem]'

export function KeyPane({ detail, pending, onClose, onSuspend, onRestore, onLimit }: KeyPaneProps) {
  const t = useTranslations('adminOpen')
  const format = useFormatter()
  const shown = useLast(detail)
  const day = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <ReviewPane
      heading={shown?.key.name ?? ''}
      note={shown === undefined ? undefined : `${shown.key.prefix}…`}
      open={detail !== undefined}
      onClose={onClose}
      renderContent={() =>
        shown === undefined ? null : (
          <Stack gap="xl">
            <PaneSection label={t('pane.key')}>
              <DescriptionList orientation="horizontal" className={facts}>
                <DescriptionTerm>{t('column.status')}</DescriptionTerm>
                <DescriptionDetails>
                  <Inline gap="sm" align="center">
                    <Tag tone={shown.key.status === 'active' ? 'success' : 'warning'}>
                      {t(`status.${shown.key.status}`)}
                    </Tag>
                    {shown.key.suspended_at !== null &&
                      t('pane.suspendedAt', {
                        date: day(shown.key.suspended_at),
                        reason: shown.key.suspended_reason ?? '',
                      })}
                  </Inline>
                </DescriptionDetails>
                <DescriptionTerm>{t('pane.owner')}</DescriptionTerm>
                <DescriptionDetails>
                  <UserRef user={shown.key.owner} />
                </DescriptionDetails>
                <DescriptionTerm>{t('pane.created')}</DescriptionTerm>
                <DescriptionDetails>{day(shown.key.created)}</DescriptionDetails>
                <DescriptionTerm>{t('pane.used')}</DescriptionTerm>
                <DescriptionDetails>
                  {shown.key.last_used_at === null
                    ? t('neverUsed')
                    : t.rich('pane.usedFrom', {
                        ip: shown.key.last_used_ip ?? '',
                        time: () => <Time value={shown.key.last_used_at ?? ''} format="relative" />,
                      })}
                </DescriptionDetails>
              </DescriptionList>
            </PaneSection>
            <PaneSection label={t('pane.usage')}>
              <Text as="span" size="sm" tone="muted">
                {t('pane.usageTotal', shown.total)}
              </Text>
              <UsageChart
                days={shown.days ?? []}
                label={t('pane.usage')}
                className="min-h-40 w-full"
              />
            </PaneSection>
            <PaneSection label={t('pane.account')}>
              <DescriptionList orientation="horizontal" className={facts}>
                <DescriptionTerm>{t('pane.limit')}</DescriptionTerm>
                <DescriptionDetails>
                  <Inline gap="sm" align="center" className="justify-between">
                    {shown.account_limit === null
                      ? t('pane.limitDefault')
                      : t('pane.limitOwn', { limit: shown.account_limit })}
                    <Button
                      size="sm"
                      variant="outline"
                      tone="neutral"
                      onClick={() => onLimit(shown)}
                    >
                      {t('pane.change')}
                    </Button>
                  </Inline>
                </DescriptionDetails>
                <DescriptionTerm>{t('pane.others')}</DescriptionTerm>
                <DescriptionDetails>
                  {(shown.others ?? []).length === 0
                    ? t('pane.noOthers')
                    : (shown.others ?? [])
                        .map(other => `${other.name}（${other.prefix}…）`)
                        .join('、')}
                </DescriptionDetails>
              </DescriptionList>
            </PaneSection>
          </Stack>
        )
      }
      renderFooter={() =>
        shown === undefined ? null : shown.key.status === 'suspended' ? (
          <Button
            variant="outline"
            tone="neutral"
            icon={<RotateCcw />}
            loading={pending}
            onClick={() => onRestore(shown)}
          >
            {t('menu.restore')}
          </Button>
        ) : (
          <Button variant="outline" tone="danger" icon={<Ban />} onClick={() => onSuspend(shown)}>
            {t('menu.suspend')}
          </Button>
        )
      }
    />
  )
}

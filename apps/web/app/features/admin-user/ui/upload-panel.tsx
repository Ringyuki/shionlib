import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Divider,
  Inline,
  Panel,
  Progress,
  Stack,
  Switch,
  Text,
  Time,
  toast,
} from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { nextStep, tierStep, type Ladder, type UserDetail } from '../admin-user'
import { useUserChange } from '../use-user-change'

type UploadPanelProps = {
  detail: UserDetail
  ladder: Ladder
  manageable: boolean
}

export function UploadPanel({ detail, ladder, manageable }: UploadPanelProps) {
  const t = useTranslations('adminUser.upload')
  const bytes = useBytes('short')
  const change = useUserChange()
  const { upload } = detail
  const next = nextStep(ladder, upload)
  const trusted = tierStep(ladder, 'trusted')
  const granted = change.submitted?.action === 'trust' ? change.submitted.trusted : upload.trusted
  return (
    <Panel title={t('title')}>
      <Stack gap="md">
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
          <DescriptionTerm>{t('tier')}</DescriptionTerm>
          <DescriptionDetails>
            {t('tierValue', { tier: upload.tier })}
            <Text as="span" tone="muted" size="inherit">
              {t('progress', {
                approved: upload.approved,
                next: next?.tier ?? 'none',
                after: next?.after ?? 0,
              })}
            </Text>
          </DescriptionDetails>
          <DescriptionTerm>{t('stored')}</DescriptionTerm>
          <DescriptionDetails>
            {upload.stored_limit === null ? (
              t('storedUnlimited', { used: bytes(upload.stored) })
            ) : (
              <Inline gap="md" align="center" wrap={false}>
                <Progress
                  size="sm"
                  className="w-48 max-w-full"
                  value={upload.stored}
                  max={Math.max(upload.stored_limit, 1)}
                  aria-label={t('stored')}
                />
                <Text as="span" size="inherit" className="tabular-nums">
                  {t('usage', { used: bytes(upload.stored), limit: bytes(upload.stored_limit) })}
                </Text>
              </Inline>
            )}
          </DescriptionDetails>
          <DescriptionTerm>{t('inFlight')}</DescriptionTerm>
          <DescriptionDetails className="tabular-nums">
            {t('usage', { used: bytes(upload.in_flight), limit: bytes(upload.in_flight_limit) })}
          </DescriptionDetails>
          <DescriptionTerm>{t('violations')}</DescriptionTerm>
          <DescriptionDetails>
            {t('violationsValue', { count: detail.violations })}
            {upload.frozen_until !== null && (
              <Text as="span" tone="muted" size="inherit">
                {t.rich('frozen', {
                  time: () => <Time value={upload.frozen_until} format="date" />,
                })}
              </Text>
            )}
          </DescriptionDetails>
        </DescriptionList>
        <Divider />
        <Switch
          checked={granted}
          disabled={!manageable || upload.tier === 'admin' || change.pending}
          description={t('trustedHint', {
            stored: t('storedLimit', {
              limited: String(typeof trusted?.stored_limit === 'number'),
              size: bytes(trusted?.stored_limit ?? 0),
            }),
            limited: String(typeof trusted?.max_file_size === 'number'),
            file: bytes(trusted?.max_file_size ?? 0),
          })}
          onCheckedChange={async wanted => {
            const outcome = await change.run({ action: 'trust', id: detail.id, trusted: wanted })
            if (outcome.ok) {
              toast.success(t('trustSaved', { trusted: String(wanted) }))
            }
          }}
        >
          {t('trusted')}
        </Switch>
      </Stack>
    </Panel>
  )
}

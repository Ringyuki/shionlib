import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Link,
  Panel,
  Text,
  Time,
} from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { adminPaths } from '~/features/admin'
import { profilePath } from '~/features/profile'
import { Button } from '~/shared/ui/button'
import type { Records, UserDetail } from '../admin-user'

type RecordsPanelProps = {
  detail: UserDetail
  records: Records
}

export function RecordsPanel({ detail, records }: RecordsPanelProps) {
  const t = useTranslations('adminUser.records')
  const locale = useLocale()
  return (
    <Panel title={t('title')}>
      <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
        <DescriptionTerm>{t('resources')}</DescriptionTerm>
        <DescriptionDetails>
          <Link href={profilePath(locale, detail.id)} target="_blank" rel="noreferrer">
            {t('resourcesValue', { count: detail.counts.resources })}
          </Link>
        </DescriptionDetails>
        <DescriptionTerm>{t('uploads')}</DescriptionTerm>
        <DescriptionDetails>
          <Link asChild>
            <RouterLink to={adminPaths.uploadsBy(detail.id)}>{t('uploadsValue')}</RouterLink>
          </Link>
        </DescriptionDetails>
        <DescriptionTerm>{t('comments')}</DescriptionTerm>
        <DescriptionDetails>
          <Link asChild>
            <RouterLink to={adminPaths.commentsBy(detail.id)}>
              {t('commentsValue', { count: detail.counts.comments })}
            </RouterLink>
          </Link>
        </DescriptionDetails>
        <DescriptionTerm>{t('reports')}</DescriptionTerm>
        <DescriptionDetails>
          <Inline gap="md">
            <Link asChild>
              <RouterLink to={adminPaths.reportsBy(detail.id)}>
                {t('reportsFiled', { count: records.reportsFiled })}
              </RouterLink>
            </Link>
            <Link asChild>
              <RouterLink to={adminPaths.reportsAgainst(detail.id)}>
                {t('reportsAgainst', { count: records.reportsAgainst })}
              </RouterLink>
            </Link>
          </Inline>
        </DescriptionDetails>
        <DescriptionTerm>{t('checks')}</DescriptionTerm>
        <DescriptionDetails>
          {records.heldFiles === 0 ? (
            <Text as="span" size="inherit" tone="muted">
              {t('noHeldFiles')}
            </Text>
          ) : (
            <Link asChild>
              <RouterLink to={adminPaths.checks}>
                {t('heldFiles', { count: records.heldFiles })}
              </RouterLink>
            </Link>
          )}
        </DescriptionDetails>
        <DescriptionTerm>{t('apiKeys')}</DescriptionTerm>
        <DescriptionDetails>
          {records.apiKeys === 0 ? (
            <Text as="span" size="inherit" tone="muted">
              {t('noApiKeys')}
            </Text>
          ) : (
            <Inline gap="sm">
              <Link asChild>
                <RouterLink to={adminPaths.keysOf(detail.id)}>
                  {t('apiKeysValue', { count: records.apiKeys })}
                </RouterLink>
              </Link>
              <Text as="span" size="inherit" tone="muted">
                {t('apiRequests', { count: records.apiRequests })}
              </Text>
            </Inline>
          )}
        </DescriptionDetails>
      </DescriptionList>
    </Panel>
  )
}

type BadgePanelProps = {
  detail: UserDetail
  onEdit: () => void
}

export function BadgePanel({ detail, onEdit }: BadgePanelProps) {
  const t = useTranslations('adminUser.badge')
  return (
    <Panel
      title={t('title')}
      actions={
        <Button size="sm" variant="outline" tone="neutral" onClick={onEdit}>
          {t('edit')}
        </Button>
      }
    >
      <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
        <DescriptionTerm>{t('until')}</DescriptionTerm>
        <DescriptionDetails>
          {detail.sponsor_expires_at === null ? (
            <Text as="span" size="inherit" tone="muted">
              {t('none')}
            </Text>
          ) : (
            <Time value={detail.sponsor_expires_at} format="date" />
          )}
        </DescriptionDetails>
      </DescriptionList>
    </Panel>
  )
}

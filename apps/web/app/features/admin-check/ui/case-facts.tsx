import {
  Alert,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Link,
  Stack,
  Text,
  Time,
} from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { adminPaths, PaneSection } from '~/features/admin'
import { CheckFacts } from '~/features/inspection'
import { resourcePath } from '~/features/resource'
import { useBytes } from '~/shared/i18n/use-bytes'
import { shortHash, waiting, type Opened } from '../admin-check'
import { Detections } from './check-cells'

export function CaseFacts({ opened }: { opened: Opened }) {
  const t = useTranslations('adminCheck.pane')
  const locale = useLocale()
  const bytes = useBytes('short')
  const { detail, uploader, inspection } = opened
  return (
    <>
      <Alert tone="warning" open={waiting(detail)}>
        <Text as="span" size="inherit">
          {t.rich('deadline', {
            time: () => <Time value={detail.review_deadline} format="relative" tooltip={false} />,
          })}
        </Text>
      </Alert>
      <PaneSection label={t('file')}>
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
          <DescriptionTerm>{t('name')}</DescriptionTerm>
          <DescriptionDetails>
            <Stack gap="xs" align="start">
              <Text as="span" size="inherit" className="break-all">
                {detail.file_name}
              </Text>
              {detail.resource !== null && (
                <Link
                  href={resourcePath(locale, detail.resource.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('openResource')}
                </Link>
              )}
            </Stack>
          </DescriptionDetails>
          <DescriptionTerm>{t('size')}</DescriptionTerm>
          <DescriptionDetails>{bytes(detail.file_size)}</DescriptionDetails>
          <DescriptionTerm>
            {t('hash', { algorithm: detail.hash_algorithm ?? 'none' })}
          </DescriptionTerm>
          <DescriptionDetails className="font-mono">
            {shortHash(detail.file_hash)}
          </DescriptionDetails>
          <DescriptionTerm>{t('uploader')}</DescriptionTerm>
          <DescriptionDetails>
            <Link asChild>
              <RouterLink to={adminPaths.user(uploader.id)}>{uploader.name}</RouterLink>
            </Link>
            <Text as="span" tone="muted" size="inherit">
              {t('uploaderFacts', {
                tier: uploader.upload.tier,
                approved: uploader.upload.approved,
                violations: uploader.violations,
              })}
            </Text>
          </DescriptionDetails>
        </DescriptionList>
      </PaneSection>
      <PaneSection label={t('found')}>
        {inspection === undefined ? (
          <Detections names={detail.detected_viruses ?? []} />
        ) : (
          <Text as="div" size="sm">
            <CheckFacts inspection={inspection} />
          </Text>
        )}
      </PaneSection>
    </>
  )
}

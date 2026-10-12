import {
  Card,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Link,
  Stack,
  Text,
  Time,
} from '@hina-ui/react'
import { FileArchive, Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { adminPaths, PaneSection, titleOf, TwoLines } from '~/features/admin'
import { resourcePath } from '~/features/resource'
import { labelOf } from '~/shared/i18n/labels'
import { useBytes } from '~/shared/i18n/use-bytes'
import { checkNote, type CheckNote, type Opened, type ReportFile } from '../admin-report'

const noteIcons = { passed: ShieldCheck, held: ShieldAlert, pending: Shield, failed: ShieldAlert }

const noteTones = {
  passed: 'success',
  held: 'warning',
  pending: 'muted',
  failed: 'danger',
} as const

function FileRow({ file, game }: { file: ReportFile; game: string }) {
  const t = useTranslations('adminReport.review')
  const bytes = useBytes('short')
  const note: CheckNote = checkNote(file)
  const Icon = noteIcons[note]
  return (
    <Stack gap="sm">
      <Inline gap="sm" align="center" wrap={false}>
        <FileArchive aria-hidden className="text-muted size-4.5 shrink-0" />
        <TwoLines
          first={file.file_name}
          second={t('fileFacts', { size: bytes(file.file_size), game })}
        />
      </Inline>
      <Text as="span" size="sm" tone={noteTones[note]} className="inline-flex items-center gap-1.5">
        <Icon aria-hidden className="size-4 shrink-0" />
        {t(`check.${note}`)}
      </Text>
    </Stack>
  )
}

export function ReportFacts({ opened }: { opened: Opened }) {
  const t = useTranslations('adminReport.review')
  const locale = useLocale()
  const reasons = useMessages().resource.reason
  const { detail, uploader } = opened
  const game = titleOf(detail.resource.game)
  const files = detail.resource.files ?? []
  return (
    <>
      <PaneSection label={t('report')}>
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
          <DescriptionTerm>{t('reason')}</DescriptionTerm>
          <DescriptionDetails>{labelOf(reasons, detail.reason)}</DescriptionDetails>
          <DescriptionTerm>{t('detail')}</DescriptionTerm>
          <DescriptionDetails className="break-words whitespace-pre-wrap">
            {detail.detail === null || detail.detail === '' ? t('noDetail') : detail.detail}
          </DescriptionDetails>
          <DescriptionTerm>{t('reporter')}</DescriptionTerm>
          <DescriptionDetails>
            <Link asChild>
              <RouterLink to={adminPaths.user(detail.reporter.id)}>
                {detail.reporter.name}
              </RouterLink>
            </Link>
            <Text as="span" tone="muted" size="inherit">
              {t('record', detail.reporter_record)}
            </Text>
          </DescriptionDetails>
          <DescriptionTerm>{t('time')}</DescriptionTerm>
          <DescriptionDetails>
            <Time value={detail.created} />
          </DescriptionDetails>
        </DescriptionList>
      </PaneSection>
      <PaneSection label={t('resource')}>
        <Card>
          <Stack gap="md">
            {files.map(file => (
              <FileRow key={file.id} file={file} game={game} />
            ))}
            {files.length === 0 && (
              <Text as="span" size="sm" tone="muted">
                {t('noFiles', { game })}
              </Text>
            )}
            <Link
              href={resourcePath(locale, detail.resource.id)}
              target="_blank"
              rel="noreferrer"
              className="text-sm"
            >
              {t('openResource')}
            </Link>
          </Stack>
        </Card>
      </PaneSection>
      <PaneSection label={t('uploader')}>
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
          <DescriptionTerm>{t('user')}</DescriptionTerm>
          <DescriptionDetails>
            <Link asChild>
              <RouterLink to={adminPaths.user(uploader.id)}>{uploader.name}</RouterLink>
            </Link>
            <Text as="span" tone="muted" size="inherit">
              {t('tier', { tier: uploader.upload.tier })}
            </Text>
          </DescriptionDetails>
          <DescriptionTerm>{t('uploads')}</DescriptionTerm>
          <DescriptionDetails>
            {t('uploadsValue', {
              approved: uploader.upload.approved,
              violations: uploader.violations,
            })}
          </DescriptionDetails>
        </DescriptionList>
      </PaneSection>
    </>
  )
}

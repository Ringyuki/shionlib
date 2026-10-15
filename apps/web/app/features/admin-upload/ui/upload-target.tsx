import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Link,
  Tag,
  Text,
  Time,
} from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { adminPaths, titleOf } from '~/features/admin'
import { gamePath } from '~/features/game'
import { resourcePath } from '~/features/resource'
import type { UploadDetail } from '../admin-upload'

type Target = NonNullable<UploadDetail['target']>

const tones = { stored: 'success', rejected: 'danger' } as const

export function UploadTarget({ detail, target }: { detail: UploadDetail; target: Target }) {
  const t = useTranslations('adminUpload')
  const locale = useLocale()
  const stage = detail.file_stage
  const held = stage === 'under_review' || stage === 'stalled'
  return (
    <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
      {detail.game !== null && (
        <>
          <DescriptionTerm>{t('target.game')}</DescriptionTerm>
          <DescriptionDetails>
            <Link href={gamePath(locale, detail.game.id)} target="_blank" rel="noreferrer">
              {titleOf(detail.game)}
            </Link>
          </DescriptionDetails>
        </>
      )}
      <DescriptionTerm>{t('target.resource')}</DescriptionTerm>
      <DescriptionDetails>
        {target.resource_removed ? (
          <Text as="span" size="inherit" tone="muted">
            {`#${target.resource_id} ${t('target.removed')}`}
          </Text>
        ) : (
          <Link
            href={resourcePath(locale, target.resource_id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1"
          >
            {`#${target.resource_id}`}
            <ExternalLink aria-label={t('target.openResource')} className="size-3.5" />
          </Link>
        )}
      </DescriptionDetails>
      <DescriptionTerm>{t('target.file')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">{`#${target.file_id}`}</DescriptionDetails>
      {stage !== null && (
        <>
          <DescriptionTerm>{t('target.check')}</DescriptionTerm>
          <DescriptionDetails>
            <Inline gap="sm" align="center">
              <Tag tone={stage === 'stored' || stage === 'rejected' ? tones[stage] : 'info'}>
                {t(`fileStage.${stage}`)}
              </Tag>
              {detail.rejection !== null && (
                <Text as="span" size="inherit">
                  {t(`rejection.${detail.rejection}`)}
                </Text>
              )}
              {target.inspection_id !== null && stage === 'stored' && (
                <Text as="span" size="inherit" tone="muted">
                  {t('target.inspected')}
                </Text>
              )}
              {held && (
                <Link asChild>
                  <RouterLink to={adminPaths.checks}>{t('target.inChecks')}</RouterLink>
                </Link>
              )}
            </Inline>
          </DescriptionDetails>
          <DescriptionTerm>{t('target.storage')}</DescriptionTerm>
          <DescriptionDetails>
            {t(stage === 'stored' ? 'storage.objectStore' : 'storage.server')}
          </DescriptionDetails>
        </>
      )}
      <DescriptionTerm>{t('target.published')}</DescriptionTerm>
      <DescriptionDetails>
        {target.resource_published_at === null ? (
          <Text as="span" size="inherit" tone="muted">
            {t('target.unpublished')}
          </Text>
        ) : (
          <Time value={target.resource_published_at} format="datetime" tooltip={false} />
        )}
      </DescriptionDetails>
    </DescriptionList>
  )
}

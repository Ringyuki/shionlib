import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Link,
  Progress,
  Stack,
  Text,
  Time,
} from '@hina-ui/react'
import { Fragment } from 'react'
import { Link as RouterLink } from 'react-router'
import { useTranslations } from 'use-intl'
import { adminPaths } from '~/features/admin'
import { useBytes } from '~/shared/i18n/use-bytes'
import { percentOf, shortHash, type UploadDetail } from '../admin-upload'
import { StageTag } from './upload-stage'

type Moment = { term: string; at: string | null | undefined }

function Moments({ moments }: { moments: Moment[] }) {
  return moments.map(({ term, at }) =>
    at === null || at === undefined ? null : (
      <Fragment key={term}>
        <DescriptionTerm>{term}</DescriptionTerm>
        <DescriptionDetails>
          <Time value={at} format="datetime" tooltip={false} />
        </DescriptionDetails>
      </Fragment>
    ),
  )
}

export function UploadFacts({ detail }: { detail: UploadDetail }) {
  const t = useTranslations('adminUpload')
  const bytes = useBytes()
  const session = detail.session
  const open = detail.stage === 'uploading' || detail.stage === 'pending'
  return (
    <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
      <DescriptionTerm>{t('fact.stage')}</DescriptionTerm>
      <DescriptionDetails>
        <StageTag stage={detail.stage} />
      </DescriptionDetails>
      <DescriptionTerm>{t('fact.uploader')}</DescriptionTerm>
      <DescriptionDetails>
        <Link asChild>
          <RouterLink to={adminPaths.user(detail.uploader.id)}>{detail.uploader.name}</RouterLink>
        </Link>
        <Text as="span" size="inherit" tone="faint" className="ms-1">
          #{detail.uploader.id}
        </Text>
      </DescriptionDetails>
      <DescriptionTerm>{t('fact.file')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        {session === null
          ? bytes(detail.size)
          : t('fileShape', {
              size: bytes(detail.size),
              chunks: detail.chunks,
              chunk: bytes(session.chunk_size),
            })}
      </DescriptionDetails>
      {session !== null && (
        <>
          <DescriptionTerm>{t('fact.progress')}</DescriptionTerm>
          <DescriptionDetails>
            <Stack gap="xs">
              <Text as="span" size="inherit" className="tabular-nums">
                {t('progressValue', {
                  received: detail.received,
                  chunks: detail.chunks,
                  percent: percentOf(detail),
                })}
              </Text>
              <Progress
                value={detail.received}
                max={Math.max(detail.chunks, 1)}
                size="sm"
                tone={detail.received === detail.chunks ? 'neutral' : 'accent'}
                aria-label={t('fact.progress')}
                className="w-72 max-w-full"
              />
            </Stack>
          </DescriptionDetails>
          {session.file_hash !== '' && (
            <>
              <DescriptionTerm>{t('fact.hash')}</DescriptionTerm>
              <DescriptionDetails className="font-mono break-all">
                {`${session.hash_algorithm.toUpperCase()} ${shortHash(session.file_hash)}`}
              </DescriptionDetails>
            </>
          )}
        </>
      )}
      <Moments
        moments={[
          { term: t(session === null ? 'fact.time' : 'fact.started'), at: detail.started },
          {
            term: t('fact.lastChunk'),
            at: session?.completed_at === null ? session.last_chunk_at : undefined,
          },
          {
            term: t('fact.deadline'),
            at: open || detail.stage === 'expired' ? session?.expires_at : undefined,
          },
          { term: t('fact.completed'), at: session?.completed_at },
          { term: t('fact.cancelled'), at: session?.aborted_at },
          {
            term: t('fact.ended'),
            at: detail.stage === 'expired' ? (session?.ended_at ?? session?.updated) : undefined,
          },
        ]}
      />
      {open && detail.held && (
        <>
          <DescriptionTerm>{t('fact.held')}</DescriptionTerm>
          <DescriptionDetails>{t('heldValue')}</DescriptionDetails>
        </>
      )}
      {session !== null &&
        detail.target === null &&
        (detail.stage === 'pending' || detail.stage === 'expired') && (
          <>
            <DescriptionTerm>{t('fact.where')}</DescriptionTerm>
            <DescriptionDetails>
              <Text as="span" size="inherit" tone="muted">
                {t('unsubmitted')}
              </Text>
            </DescriptionDetails>
          </>
        )}
    </DescriptionList>
  )
}

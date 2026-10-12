import { Tag } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { titleOf } from '../admin'
import type { QueueEntry, QueueKind } from '../admin-queue'
import { TwoLines } from './two-lines'
import { UserRef } from './user-ref'

const tones = {
  malware: 'danger',
  stalled: 'warning',
  report: 'accent',
} as const satisfies Record<QueueKind, string>

export function KindTag({ kind }: { kind: QueueKind }) {
  const t = useTranslations('admin.overview.pending.kind')
  return <Tag tone={tones[kind]}>{t(kind)}</Tag>
}

export function QueueContent({ entry }: { entry: QueueEntry }) {
  const t = useTranslations('admin.overview.pending')
  const reasons = useMessages().resource.reason
  switch (entry.kind) {
    case 'malware':
      return (
        <TwoLines
          first={entry.subject.file_name}
          second={t('detected', {
            names: (entry.subject.detected_viruses ?? []).join(t('separator')),
          })}
        />
      )
    case 'stalled':
      return (
        <TwoLines
          first={entry.subject.file_name}
          second={t('stalled', { reason: entry.subject.reason, count: entry.subject.failures })}
        />
      )
    case 'report': {
      const { resource, reason, detail } = entry.subject
      const label = labelOf(reasons, reason)
      return (
        <TwoLines
          first={resource.files?.[0]?.file_name ?? titleOf(resource.game)}
          second={
            detail === null || detail === '' ? label : t('reported', { reason: label, detail })
          }
        />
      )
    }
  }
}

export function QueueSubmitter({ entry }: { entry: QueueEntry }) {
  switch (entry.kind) {
    case 'malware':
    case 'stalled':
      return <UserRef user={entry.subject.uploader} />
    case 'report':
      return <UserRef user={entry.subject.reporter} />
  }
}

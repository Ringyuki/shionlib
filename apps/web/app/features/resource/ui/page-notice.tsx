import { Callout } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import type { PageNotice as Notice } from '../resource-page'

const tones = {
  checking: 'info',
  storing: 'info',
  underReview: 'warning',
  stalled: 'warning',
  awaitingVolumes: 'warning',
  rejected: 'danger',
} as const

type PageNoticeProps = { notice: Notice; published: boolean; own: boolean }

export function PageNotice({ notice, published, own }: PageNoticeProps) {
  const t = useTranslations('resource')
  const format = useFormatter()
  const { awaited } = notice
  return (
    <Callout tone={tones[notice.state]}>
      {t(`page.notice.${notice.state}`, {
        published: String(published),
        viewer: own ? 'uploader' : 'other',
        reason: notice.rejection === null ? '' : t(`rejection.${notice.rejection}`),
        names: format.list(awaited?.names ?? [], { style: 'narrow' }),
        more: awaited?.more ?? 0,
        deadline:
          awaited === undefined
            ? ''
            : format.dateTime(awaited.deadline, { dateStyle: 'medium', timeStyle: 'short' }),
      })}
    </Callout>
  )
}

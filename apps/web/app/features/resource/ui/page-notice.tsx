import { Callout } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { PageNotice as Notice } from '../resource-page'

const tones = {
  checking: 'info',
  storing: 'info',
  underReview: 'warning',
  stalled: 'warning',
  rejected: 'danger',
} as const

type PageNoticeProps = { notice: Notice; published: boolean; own: boolean }

export function PageNotice({ notice, published, own }: PageNoticeProps) {
  const t = useTranslations('resource')
  return (
    <Callout tone={tones[notice.state]}>
      {t(`page.notice.${notice.state}`, {
        published: String(published),
        viewer: own ? 'uploader' : 'other',
        reason: notice.rejection === null ? '' : t(`rejection.${notice.rejection}`),
      })}
    </Callout>
  )
}

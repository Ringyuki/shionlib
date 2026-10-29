import { Tag } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { RunStatus } from '../resource-composition'

const tones = { draft: 'neutral', queued: 'neutral', running: 'accent', failed: 'danger' } as const

export function CompositionTag({ status }: { status: RunStatus | 'draft' }) {
  const t = useTranslations('resource.composition.run')
  return (
    <Tag size="sm" tone={tones[status]} className="shrink-0">
      {t(status)}
    </Tag>
  )
}

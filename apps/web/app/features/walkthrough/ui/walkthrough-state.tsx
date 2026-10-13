import { Tag } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { stateOf, type WalkthroughSummary } from '../walkthrough'

const tones = {
  published: 'success',
  draft: 'neutral',
  reviewing: 'warning',
  hidden: 'danger',
} as const

type Stated = Pick<WalkthroughSummary, 'status' | 'review_pending'>

export function WalkthroughState({ walkthrough }: { walkthrough: Stated }) {
  const t = useTranslations('walkthrough')
  const state = stateOf(walkthrough)
  if (state === 'published') {
    return null
  }
  return (
    <Tag tone={tones[state]} className="shrink-0">
      {t(`state.${state}`)}
    </Tag>
  )
}

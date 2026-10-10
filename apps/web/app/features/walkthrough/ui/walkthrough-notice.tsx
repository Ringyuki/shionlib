import { Callout, Inline, Text, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { useWalkthroughPublish } from '../use-walkthrough-publish'
import { stateOf, type Walkthrough } from '../walkthrough'

const tones = { draft: 'neutral', reviewing: 'warning', hidden: 'danger' } as const

export function WalkthroughNotice({ walkthrough }: { walkthrough: Walkthrough }) {
  const t = useTranslations('walkthrough')
  const publish = useWalkthroughPublish()
  const state = stateOf(walkthrough)
  if (state === 'published') {
    return null
  }
  return (
    <Callout tone={tones[state]}>
      <Inline justify="between" align="center" gap="md" wrap={false}>
        <Text as="span">{t(`notice.${state}`)}</Text>
        {state === 'draft' && (
          <Button
            size="sm"
            loading={publish.pending}
            className="-my-1 shrink-0"
            onClick={async () => {
              const outcome = await publish.run({ walkthroughId: walkthrough.id })
              if (outcome.ok) {
                toast.success(
                  t(outcome.result.state === 'published' ? 'published' : 'sentForReview'),
                )
              }
            }}
          >
            {t('publish')}
          </Button>
        )}
      </Inline>
    </Callout>
  )
}

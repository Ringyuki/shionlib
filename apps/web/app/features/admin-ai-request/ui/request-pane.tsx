import { Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PaneSection, ReviewPane } from '~/features/admin'
import type { SceneName } from '~/features/admin-ai'
import { useLast } from '~/shared/ui/use-last'
import { shortCall, type Logged, type LoggedDetail } from '../admin-ai-request'
import { RequestAttempts } from './request-attempts'
import { RequestFacts } from './request-facts'
import { RequestPayload } from './request-payload'

type RequestPaneProps = {
  opened: LoggedDetail | undefined
  scenes: SceneName[]
  onOpen: (request: Logged) => void
  onClose: () => void
}

export function RequestPane({ opened, scenes, onOpen, onClose }: RequestPaneProps) {
  const t = useTranslations('adminAiRequest')
  const shown = useLast(opened)
  return (
    <ReviewPane
      heading={t('pane.title')}
      note={shown === undefined ? undefined : t('pane.call', { id: shortCall(shown) })}
      open={opened !== undefined}
      onClose={onClose}
      renderContent={() =>
        shown === undefined ? null : (
          <Stack gap="xl">
            <PaneSection label={t('pane.facts')}>
              <RequestFacts detail={shown} scenes={scenes} />
            </PaneSection>
            <PaneSection label={t('attempts.title')}>
              <RequestAttempts detail={shown} onOpen={onOpen} />
            </PaneSection>
            <RequestPayload detail={shown} />
          </Stack>
        )
      }
    />
  )
}

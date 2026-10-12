import { Alert, Card, Stack } from '@hina-ui/react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { searchSet } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import type { SceneListing } from '../admin-ai.use-cases'
import { GatewayFrame } from './gateway-frame'
import { ScenePane } from './scene-pane'
import { SceneTable } from './scene-table'

type AiScenesPageProps = SceneListing & {
  editable: boolean
}

export function AiScenesPage({ scenes, models, opened, editable }: AiScenesPageProps) {
  const t = useTranslations('adminAi')
  const location = useLocation()
  const stay = useInPageNavigate()
  const open = (key: string | undefined) =>
    stay({ search: searchSet(location.search, 'scene', key) })
  return (
    <GatewayFrame tab="scenes">
      <Stack gap="lg">
        <Alert tone="info" open={!editable}>
          {t('readOnly')}
        </Alert>
        <Card padded={false}>
          <SceneTable
            scenes={scenes}
            models={models}
            editable={editable}
            onAdjust={scene => open(scene.key)}
          />
        </Card>
      </Stack>
      <ScenePane
        opened={opened}
        models={models}
        editable={editable}
        onClose={() => open(undefined)}
      />
    </GatewayFrame>
  )
}

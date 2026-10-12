import { Alert, AlertDialog, Grid, Stack, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { aiPaths, GatewayFrame } from '~/features/admin-ai'
import type { Opened } from '../admin-ai-model.use-cases'
import { useModelChange } from '../use-model-change'
import { ModelHead } from './model-head'
import { ModelRoutes } from './model-routes'
import { ModelScenes } from './model-scenes'
import { ModelSettings } from './model-settings'
import { RouteAddDialog } from './route-add-dialog'

type AiModelPageProps = Opened & {
  editable: boolean
}

type Asked = 'remove' | 'route'

export function AiModelPage({ model, providers, scenes, editable }: AiModelPageProps) {
  const t = useTranslations('adminAiModel')
  const shared = useTranslations('adminAi')
  const common = useTranslations('admin')
  const navigate = useNavigate()
  const [asked, setAsked] = useState<Asked>()
  const remove = useModelChange({ revalidate: false })
  const closing = (kind: Asked) => (open: boolean) => setAsked(open ? kind : undefined)
  return (
    <GatewayFrame
      tab="models"
      head={<ModelHead model={model} editable={editable} onRemove={() => setAsked('remove')} />}
    >
      <Stack gap="lg">
        <Alert tone="info" open={!editable}>
          {shared('readOnly')}
        </Alert>
        <ModelRoutes
          model={model}
          providers={providers}
          editable={editable}
          onAdd={() => setAsked('route')}
        />
        <Grid gap="none" className="items-start gap-6 xl:grid-cols-2">
          <ModelSettings key={model.updated} model={model} editable={editable} />
          <ModelScenes model={model} scenes={scenes} />
        </Grid>
      </Stack>
      <RouteAddDialog
        model={model}
        providers={providers}
        open={asked === 'route'}
        onOpenChange={closing('route')}
      />
      <AlertDialog
        tone="danger"
        title={t('remove.title', { name: model.name })}
        description={t('remove.description', { count: (model.routes ?? []).length })}
        confirmText={t('remove.confirm')}
        cancelText={common('cancel')}
        open={asked === 'remove'}
        onOpenChange={closing('remove')}
        onConfirm={async () => {
          await remove.confirm({ action: 'remove', id: model.id })
          toast.success(t('remove.done', { name: model.name }))
          void navigate(aiPaths.models)
        }}
      />
    </GatewayFrame>
  )
}

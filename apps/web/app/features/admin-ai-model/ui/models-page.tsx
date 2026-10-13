import { Alert, Card, Stack, Time } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { GatewayFrame } from '~/features/admin-ai'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { Button } from '~/shared/ui/button'
import { matching, searchOf, type Filter } from '../admin-ai-model'
import type { Listing } from '../admin-ai-model.use-cases'
import { ModelAddDialog } from './model-add-dialog'
import { ModelTable } from './model-table'
import { ModelsToolbar } from './models-toolbar'

type AiModelsPageProps = Listing & {
  editable: boolean
}

export function AiModelsPage({ filter, models, catalog, editable }: AiModelsPageProps) {
  const t = useTranslations('adminAiModel')
  const shared = useTranslations('adminAi')
  const stay = useInPageNavigate()
  const [adding, setAdding] = useState(false)
  const show = (changes: Partial<Filter>) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace: true })
  return (
    <GatewayFrame
      tab="models"
      actions={
        <Button icon={<Plus />} disabled={!editable} onClick={() => setAdding(true)}>
          {t('add.open')}
        </Button>
      }
    >
      <Stack gap="lg">
        <Alert tone="info" open={!editable}>
          {shared('readOnly')}
        </Alert>
        <Card padded={false}>
          <ModelsToolbar filter={filter} editable={editable} onShow={show} />
          <ModelTable
            models={matching(models, filter)}
            filtered={models.length > 0}
            editable={editable}
            note={t.rich('catalog', {
              synced: String(catalog.synced_at !== null),
              time: () => <Time value={catalog.synced_at} format="relative" />,
            })}
          />
        </Card>
      </Stack>
      <ModelAddDialog open={adding} onOpenChange={setAdding} />
    </GatewayFrame>
  )
}

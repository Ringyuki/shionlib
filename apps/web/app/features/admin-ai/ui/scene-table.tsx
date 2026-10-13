import { Text, toast } from '@hina-ui/react'
import { Settings } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { IconButton } from '~/shared/ui/button'
import { draftOf, type Model, type Scene } from '../admin-ai-scene'
import { useAiFormat } from '../use-ai-format'
import { useSceneSave } from '../use-scene-save'
import { SceneModelSelect } from './scene-model-select'
import { SceneStatus, useSceneStatus } from './scene-status'

type SceneTableProps = {
  scenes: Scene[]
  models: Model[]
  editable: boolean
  onAdjust: (scene: Scene) => void
}

export function SceneTable({ scenes, models, editable, onAdjust }: SceneTableProps) {
  const t = useTranslations('adminAi.scenes')
  const format = useAiFormat()
  const status = useSceneStatus()
  const save = useSceneSave()
  const columns: RecordColumn[] = [
    { key: 'scene', label: t('column.scene'), fill: true },
    { key: 'output', label: t('column.output'), wide: true },
    { key: 'model', label: t('column.model') },
    { key: 'status', label: t('column.status'), wide: true },
    { key: 'requests', label: t('column.requests'), align: 'end', wide: true },
    { key: 'failureRate', label: t('column.failureRate'), align: 'end', wide: true },
    { key: 'cost', label: t('column.cost'), align: 'end', wide: true },
    { key: 'adjust', label: '' },
  ]
  const choose = async (scene: Scene, modelId: number | null) => {
    const outcome = await save.run({ ...draftOf(scene), key: scene.key, modelId })
    if (outcome.ok) {
      const model = models.find(candidate => candidate.id === modelId)?.name
      toast.success(
        model === undefined
          ? t('follows', { scene: scene.label })
          : t('changed', { scene: scene.label, model }),
      )
    }
  }
  return (
    <RecordTable
      label={t('label')}
      rows={scenes}
      rowKey={scene => scene.key}
      columns={columns}
      empty={t('empty')}
      footer={
        <Text as="span" size="sm" tone="muted">
          {t('note')}
        </Text>
      }
      renderCell={(scene, column) => {
        switch (column) {
          case 'scene':
            return (
              <TwoLines
                first={scene.label}
                second={scene.key}
                narrow={status(scene, models).label}
                mono
              />
            )
          case 'output':
            return t(`output.${scene.output}`)
          case 'model':
            return (
              <SceneModelSelect
                scene={scene}
                models={models}
                size="sm"
                className="w-56 max-md:w-40"
                disabled={!editable || save.pending}
                value={
                  save.pending && save.submitted?.key === scene.key
                    ? save.submitted.modelId
                    : (scene.model?.id ?? null)
                }
                onChange={modelId => void choose(scene, modelId)}
              />
            )
          case 'status':
            return <SceneStatus scene={scene} models={models} />
          case 'requests':
            return format.count(scene.stats.requests)
          case 'failureRate':
            return format.rate(scene.stats)
          case 'cost':
            return format.usd(scene.stats.cost_usd)
          default:
            return (
              <IconButton
                variant="ghost"
                tone="neutral"
                size="sm"
                label={t('adjust', { scene: scene.label })}
                onClick={() => onAdjust(scene)}
              >
                <Settings />
              </IconButton>
            )
        }
      }}
    />
  )
}

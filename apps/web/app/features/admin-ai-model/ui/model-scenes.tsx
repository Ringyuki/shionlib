import { Panel } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { aiPaths, useAiFormat } from '~/features/admin-ai'
import { sceneRequests, type Model, type SceneUse } from '../admin-ai-model'

type ModelScenesProps = {
  model: Model
  scenes: SceneUse[]
}

export function ModelScenes({ model, scenes }: ModelScenesProps) {
  const t = useTranslations('adminAiModel.scenes')
  const format = useAiFormat()
  const navigate = useNavigate()
  const columns: RecordColumn[] = [
    { key: 'scene', label: t('column.scene'), fill: true },
    { key: 'role', label: t('column.role') },
    { key: 'requests', label: t('column.requests'), align: 'end' },
  ]
  return (
    <Panel title={t('title')} padded={false}>
      <RecordTable
        label={t('title')}
        rows={model.scenes ?? []}
        rowKey={scene => scene.key}
        columns={columns}
        empty={t('empty')}
        onOpen={() => void navigate(aiPaths.scenes)}
        renderCell={(scene, column) => {
          switch (column) {
            case 'scene':
              return <TwoLines first={scene.label} second={scene.key} mono />
            case 'role':
              return t(`role.${scene.role}`)
            default:
              return format.count(sceneRequests(scenes, scene.key))
          }
        }}
      />
    </Panel>
  )
}

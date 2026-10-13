import { Select } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { defaultModel, followDefault, modelsFor, type Model, type Scene } from '../admin-ai-scene'

type SceneModelSelectProps = {
  scene: Scene
  models: readonly Model[]
  value: number | null
  disabled: boolean
  size?: 'sm' | 'md'
  className?: string
  onChange: (modelId: number | null) => void
}

export function SceneModelSelect({
  scene,
  models,
  value,
  disabled,
  size,
  className,
  onChange,
}: SceneModelSelectProps) {
  const t = useTranslations('adminAi.scenes')
  const fallback = defaultModel(models)
  const chosen = models.find(model => model.id === value)
  const listed = modelsFor(scene, models)
  const offered = chosen === undefined || listed.includes(chosen) ? listed : [chosen, ...listed]
  return (
    <Select
      size={size}
      aria-label={t('modelLabel', { scene: scene.label })}
      className={className}
      disabled={disabled}
      value={value === null ? followDefault : String(value)}
      options={[
        {
          value: followDefault,
          label:
            fallback === undefined ? t('noDefault') : t('followDefault', { name: fallback.name }),
        },
        ...offered.map(model => ({ value: String(model.id), label: model.name })),
      ]}
      onValueChange={picked =>
        onChange(offered.find(model => String(model.id) === picked)?.id ?? null)
      }
    />
  )
}

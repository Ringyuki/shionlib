import { useTranslations } from 'use-intl'
import { sceneHealth, type Model, type Scene } from '../admin-ai-scene'
import { StatusLine } from './status-line'

type SceneStatusProps = {
  scene: Scene
  models: readonly Model[]
}

export function useSceneStatus() {
  const t = useTranslations('adminAi.scenes.status')
  return (scene: Scene, models: readonly Model[]) => {
    const health = sceneHealth(scene, models)
    switch (health.state) {
      case 'problem':
        return { tone: 'danger' as const, label: t(health.problem) }
      case 'thin':
        return {
          tone: 'warning' as const,
          label: t('thin', { active: health.active }),
          note: t('thinNote', { names: health.suspended.join(t('separator')) }),
        }
      default:
        return { tone: 'success' as const, label: t('fine') }
    }
  }
}

export function SceneStatus({ scene, models }: SceneStatusProps) {
  const status = useSceneStatus()(scene, models)
  return <StatusLine {...status} alarming={status.tone === 'danger'} />
}

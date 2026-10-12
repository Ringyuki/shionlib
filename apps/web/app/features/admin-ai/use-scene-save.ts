import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { sceneCommand, type SceneSave } from './admin-ai.schema'
import type { aiSceneAction } from './admin-ai.server'

export function useSceneSave() {
  const command = useCommand(useFetcher<typeof aiSceneAction>(), href('/resources/admin/ai/scenes'))
  return {
    ...command,
    submitted: parseOptional(sceneCommand, command.payload),
    run: (save: SceneSave) => command.run(save),
  }
}

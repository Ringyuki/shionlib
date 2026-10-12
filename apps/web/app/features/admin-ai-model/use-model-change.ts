import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { modelCommand, type ModelChange } from './admin-ai-model.schema'
import type { aiModelAction } from './admin-ai-model.server'

export function useModelChange(options: { revalidate?: boolean } = {}) {
  const command = useCommand(
    useFetcher<typeof aiModelAction>(),
    href('/resources/admin/ai/models'),
    options,
  )
  return {
    ...command,
    submitted: parseOptional(modelCommand, command.payload),
    run: (change: ModelChange) => command.run(change),
    confirm: (change: ModelChange) => command.confirm(change),
  }
}

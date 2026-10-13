import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { CompositionCommand } from './resource-composition.schema'
import type { compositionAction } from './resource.server'

export function useCompositionCommand() {
  const command = useCommand(useFetcher<typeof compositionAction>(), href('/resources/composition'))
  return {
    ...command,
    run: (input: CompositionCommand) => command.run(input),
    confirm: (input: CompositionCommand) => command.confirm(input),
  }
}

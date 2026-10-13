import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { GameChange } from './admin-game.schema'
import type { gameAction } from './admin-game.server'

export function useGameChange() {
  const command = useCommand(useFetcher<typeof gameAction>(), href('/resources/admin/games'))
  return {
    ...command,
    run: (change: GameChange) => command.run(change),
    confirm: (change: GameChange) => command.confirm(change),
  }
}

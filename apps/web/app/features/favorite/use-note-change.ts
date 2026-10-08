import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { NoteChange } from './favorite.schema'
import type { favoriteNoteAction } from './favorite.server'

export function useNoteChange() {
  const command = useCommand(
    useFetcher<typeof favoriteNoteAction>(),
    href('/resources/favorites/item-note'),
  )
  return { ...command, run: (change: NoteChange) => command.run(change) }
}
